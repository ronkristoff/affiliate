import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { getAuthenticatedUser, getTenantId, requireWriteAccess } from "./tenantContext";
import { hasPermission, Role } from "./permissions";
import { api, internal } from "./_generated/api";
import { render } from "@react-email/components";
import React from "react";
import { getFromAddress } from "./emailService";

import TeamInvitationEmail from "./emails/TeamInvitation";
import TeamWelcomeEmail from "./emails/TeamWelcome";
import TeamAcceptedNotificationEmail from "./emails/TeamAcceptedNotification";

/**
 * Team Invitation System
 * 
 * Handles team member invitation creation, listing, and cancellation.
 * Includes tier limit enforcement, duplicate prevention, and audit logging.
 */

// Valid roles for team members
const TEAM_ROLES = ["owner", "manager", "viewer"] as const;
type TeamRole = typeof TEAM_ROLES[number];

// Token expiration: 7 days
const INVITATION_EXPIRATION_DAYS = 7;

/**
 * Generate a secure random token for invitation
 */
function generateInvitationToken(): string {
  // Use crypto.randomUUID for secure token generation
  return crypto.randomUUID();
}

/**
 * Calculate expiration timestamp (7 days from now)
 */
function getExpirationTimestamp(): number {
  return Date.now() + INVITATION_EXPIRATION_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * Create a team invitation (AC1, AC3, AC6, AC7)
 * 
 * Validates:
 * - User has permission to invite (RBAC)
 * - Tier limit not exceeded
 * - No duplicate invitation exists
 * - User not already a team member
 * - Manager can't invite Owner
 */
export const createTeamInvitation = mutation({
  args: {
    email: v.string(),
    role: v.union(v.literal("owner"), v.literal("manager"), v.literal("viewer")),
  },
  returns: v.object({
    invitationId: v.id("teamInvitations"),
    token: v.string(),
  }),
  handler: async (ctx, args) => {
    // Get authenticated user
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Authentication required");
    }
    await requireWriteAccess(ctx);

    const tenantId = authUser.tenantId;

    // RBAC Check: Verify user has permission to invite (AC5)
    // Owners have users:*, Managers need to check if they can invite
    if (!hasPermission(authUser.role as Role, "users:create")) {
      // Log unauthorized access attempt
      await ctx.db.insert("auditLogs", {
        tenantId,
        action: "invitation_permission_denied",
        entityType: "user",
        entityId: authUser.userId,
        actorId: authUser.userId,
        actorType: "user",
        metadata: {
          securityEvent: true,
          additionalInfo: `Attempted to invite ${args.email} as ${args.role}`,
        },
      });
      throw new Error("You don't have permission to invite team members");
    }

    // Managers cannot invite Owners (AC5)
    if (authUser.role === "manager" && args.role === "owner") {
      throw new Error("Managers cannot invite users as Owners");
    }

    // AC3: Tier Limit Enforcement
    const limitCheck = await ctx.runQuery(api.tierConfig.checkLimit, {
      tenantId,
      resourceType: "teamMembers",
    });

    if (limitCheck.status === "blocked") {
      throw new Error(
        `Team member limit reached (${limitCheck.current}/${limitCheck.limit}). Please upgrade your plan to invite more team members.`
      );
    }

    // AC6: Check for duplicate invitation (by email + tenant)
    const existingInvitation = await ctx.db
      .query("teamInvitations")
      .withIndex("by_tenant_and_email", (q) =>
        q.eq("tenantId", tenantId).eq("email", args.email.toLowerCase())
      )
      .first();

    if (existingInvitation && !existingInvitation.acceptedAt) {
      // Check if invitation has expired
      if (existingInvitation.expiresAt > Date.now()) {
        // Invitation still pending — re-send the email instead of throwing.
        // This handles the case where the first email failed to deliver.
        const inviterName = authUser.email?.split("@")[0] || "Someone";
        await ctx.scheduler.runAfter(0, internal.teamInvitations.scheduleInvitationEmail, {
          invitationId: existingInvitation._id,
          email: args.email.toLowerCase(),
          role: existingInvitation.role,
          tenantId: tenantId,
          inviterName,
        });

        // Audit log for re-send
        await ctx.db.insert("auditLogs", {
          tenantId,
          action: "team_invitation_resent",
          entityType: "teamInvitations",
          entityId: existingInvitation._id,
          actorId: authUser.userId,
          actorType: "user",
          newValue: { email: args.email.toLowerCase(), role: existingInvitation.role },
        });

        return {
          invitationId: existingInvitation._id,
          token: existingInvitation.token,
        };
      }
      // If expired, we'll allow creating a new one (falls through below)
    }

    // AC7: Check if user already exists in the tenant
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_tenant_and_email", (q) =>
        q.eq("tenantId", tenantId).eq("email", args.email.toLowerCase())
      )
      .first();

    if (existingUser) {
      throw new Error("A user with this email is already a team member");
    }

    // Generate secure token and expiration
    const token = generateInvitationToken();
    const expiresAt = getExpirationTimestamp();

    // Create the invitation
    const invitationId = await ctx.db.insert("teamInvitations", {
      tenantId,
      email: args.email.toLowerCase(),
      role: args.role,
      token,
      expiresAt,
    });

    // Audit logging for invitation creation
    await ctx.db.insert("auditLogs", {
      tenantId,
      action: "team_invitation_created",
      entityType: "teamInvitations",
      entityId: invitationId,
      actorId: authUser.userId,
      actorType: "user",
      newValue: {
        email: args.email.toLowerCase(),
        role: args.role,
        expiresAt,
      },
    });

    // Team invited notification (non-fatal, best-effort)
    try {
      const inviteeUser = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
        .first();
      if (inviteeUser) {
        await ctx.runMutation(internal.notifications.createNotification, {
          tenantId,
          userId: inviteeUser._id,
          type: "team.invited",
          title: "Team Invitation",
          message: `You have been invited to join the team as ${args.role}.`,
          severity: "info",
        });
      }
    } catch (notifErr) {
      console.error("[Notification] Failed to send team invited notification:", notifErr);
    }

    // Schedule email sending via internal mutation
    // Get inviter name for the email (use email prefix as name)
    const inviterName = authUser.email?.split('@')[0] || "Someone";
    await ctx.scheduler.runAfter(0, internal.teamInvitations.scheduleInvitationEmail, {
      invitationId,
      email: args.email.toLowerCase(),
      role: args.role,
      tenantId: tenantId,
      inviterName,
    });

    return {
      invitationId,
      token,
    };
  },
});

/**
 * Internal mutation to send the invitation email
 * Uses runMutation to access database since this is called from scheduler
 */
export const scheduleInvitationEmail = internalMutation({
  args: {
    invitationId: v.id("teamInvitations"),
    email: v.string(),
    role: v.string(),
    tenantId: v.id("tenants"),
    inviterName: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Get the invitation to get the token
    const invitation = await ctx.db.get(args.invitationId);
    if (!invitation) {
      console.error("Invitation not found:", args.invitationId);
      return null;
    }

    // Get tenant info
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) {
      console.error("Tenant not found:", args.tenantId);
      return null;
    }

    // Get the inviter info
    const inviter = args.inviterName || tenant.name || "Someone";

    // Build the invitation link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const invitationLink = `${baseUrl}/invitation/accept?token=${invitation.token}`;

    // Get tenant branding - MEDIUM fix: use tenant branding consistently
    const logoUrl = tenant.branding?.logoUrl;
    const primaryColor = tenant.branding?.primaryColor || "#1c2260";

    try {
      await ctx.scheduler.runAfter(0, internal.emailService.sendEmail, {
        from: getFromAddress("onboarding"),
        to: args.email,
        subject: `You're invited to join ${tenant.name} as a ${args.role}`,
        html: await render(
          React.createElement(TeamInvitationEmail, {
            inviteeEmail: args.email,
            inviterName: inviter,
            tenantName: tenant.name || "Your Organization",
            role: args.role,
            invitationLink,
            expiresInDays: 7,
            brandName: tenant.name,
            brandLogoUrl: logoUrl,
            primaryColor,
          })
        ),
        tracking: { tenantId: args.tenantId, type: "team_invitation" },
      });

      console.log(`Team invitation email sent to ${args.email}`);
    } catch (error) {
      console.error("Failed to send invitation email:", error);
    }

    return null;
  },
});

/**
 * Get all pending invitations for a tenant (AC4)
 */
export const getPendingInvitations = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("teamInvitations"),
      _creationTime: v.number(),
      tenantId: v.id("tenants"),
      email: v.string(),
      role: v.string(),
      expiresAt: v.number(),
      token: v.optional(v.string()),
      acceptedAt: v.optional(v.number()),
    })
  ),
  handler: async (ctx, _args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Authentication required");
    }

    const tenantId = authUser.tenantId;

    // Get all invitations for this tenant
    const invitations = await ctx.db
      .query("teamInvitations")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
      .collect();

    // Filter to only pending (not accepted) invitations
    // and sort by creation time (newest first)
    const pendingInvitations = invitations
      .filter((inv) => !inv.acceptedAt)
      .sort((a, b) => b._creationTime - a._creationTime);

    return pendingInvitations;
  },
});

/**
 * Get team member count and limit status for the current tenant
 */
export const getTeamLimitStatus = query({
  args: {},
  returns: v.object({
    current: v.number(),
    limit: v.number(),
    status: v.union(
      v.literal("ok"),
      v.literal("warning"),
      v.literal("critical"),
      v.literal("blocked")
    ),
    percentage: v.number(),
  }),
  handler: async (ctx, _args): Promise<{
    current: number;
    limit: number;
    status: "ok" | "warning" | "critical" | "blocked";
    percentage: number;
  }> => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Authentication required");
    }

    const tenantId = authUser.tenantId;

    // Get limit status - use type annotation to avoid circular reference
    const limitCheck: {
      status: "ok" | "warning" | "critical" | "blocked";
      percentage: number;
      current: number;
      limit: number;
    } = await ctx.runQuery(api.tierConfig.checkLimit, {
      tenantId,
      resourceType: "teamMembers",
    });

    return {
      current: limitCheck.current,
      limit: limitCheck.limit,
      status: limitCheck.status,
      percentage: limitCheck.percentage,
    };
  },
});

/**
 * Cancel a team invitation (AC5)
 * 
 * Removes the invitation and invalidates the token.
 * Logs the action in audit trail.
 */
export const cancelInvitation = mutation({
  args: {
    invitationId: v.id("teamInvitations"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const authUser = await getAuthenticatedUser(ctx);
    if (!authUser) {
      throw new Error("Authentication required");
    }
    await requireWriteAccess(ctx);

    const tenantId = authUser.tenantId;

    // RBAC Check: Verify user has permission to manage users
    if (!hasPermission(authUser.role as Role, "users:create")) {
      throw new Error("You don't have permission to cancel invitations");
    }

    // Get the invitation
    const invitation = await ctx.db.get(args.invitationId);
    if (!invitation) {
      throw new Error("Invitation not found");
    }

    // Verify the invitation belongs to the user's tenant
    if (invitation.tenantId !== tenantId) {
      throw new Error("Access denied");
    }

    // Check if already accepted
    if (invitation.acceptedAt) {
      throw new Error("Cannot cancel an already accepted invitation");
    }

    // Delete the invitation (this effectively invalidates the token)
    await ctx.db.delete(args.invitationId);

    // Audit logging for cancellation
    await ctx.db.insert("auditLogs", {
      tenantId,
      action: "team_invitation_cancelled",
      entityType: "teamInvitation",
      entityId: args.invitationId,
      actorId: authUser.userId,
      actorType: "user",
      metadata: {
        additionalInfo: `Cancelled invitation for ${invitation.email} (role: ${invitation.role})`,
      },
    });

    return null;
  },
});

/**
 * Internal mutation to accept an invitation
 * Called by the invitation acceptance flow (Story 2.5)
 */
export const acceptInvitation = internalMutation({
  args: {
    invitationId: v.id("teamInvitations"),
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const invitation = await ctx.db.get(args.invitationId);
    if (!invitation) {
      throw new Error("Invitation not found");
    }

    // Check if invitation has expired
    if (invitation.expiresAt < Date.now()) {
      throw new Error("Invitation has expired");
    }

    // Check if already accepted
    if (invitation.acceptedAt) {
      throw new Error("Invitation already accepted");
    }

    // Update the invitation to mark as accepted
    await ctx.db.patch(args.invitationId, {
      acceptedAt: Date.now(),
    });

    // Note: The actual user creation/role assignment is handled in Story 2.5
    // This mutation just marks the invitation as accepted

    return null;
  },
});

/**
 * Internal mutation to send acceptance notification emails
 * Sends welcome email to new team member and notification to owner
 */
export const scheduleAcceptanceEmails = internalMutation({
  args: {
    invitationId: v.id("teamInvitations"),
    userId: v.id("users"),
    tenantId: v.id("tenants"),
    email: v.string(),
    name: v.string(),
    role: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) {
      console.error("Tenant not found:", args.tenantId);
      return null;
    }

    // Get tenant branding
    const logoUrl = tenant.branding?.logoUrl;
    const primaryColor = tenant.branding?.primaryColor || "#1c2260";
    const portalName = tenant.branding?.portalName || tenant.name;

    // Send welcome email to new team member
    try {
      await ctx.scheduler.runAfter(0, internal.emailService.sendEmail, {
        from: getFromAddress("onboarding"),
        to: args.email,
        subject: `Welcome to ${portalName}!`,
        html: await render(
          React.createElement(TeamWelcomeEmail, {
            name: args.name,
            tenantName: portalName,
            role: args.role,
            loginUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/sign-in`,
            brandName: portalName,
            brandLogoUrl: logoUrl,
            primaryColor,
          })
        ),
        tracking: { tenantId: args.tenantId, type: "team_welcome" },
      });

      console.log(`Welcome email sent to ${args.email}`);
    } catch (error) {
      console.error("Failed to send welcome email:", error);
    }

    // Send notification to tenant owner(s)
    try {
      // Find all owners in the tenant
      const owners = await ctx.db
        .query("users")
        .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
        .collect();

      const ownerEmails = owners
        .filter((user) => user.role === "owner")
        .map((user) => user.email);

      if (ownerEmails.length > 0) {
        for (const ownerEmail of ownerEmails) {
          await ctx.scheduler.runAfter(0, internal.emailService.sendEmail, {
            from: getFromAddress("notifications"),
            to: ownerEmail,
            subject: `New team member joined ${portalName}`,
            html: await render(
              React.createElement(TeamAcceptedNotificationEmail, {
                ownerEmail,
                newMemberName: args.name,
                newMemberEmail: args.email,
                newMemberRole: args.role,
                tenantName: portalName,
                teamSettingsUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/settings/team`,
                brandName: portalName,
                brandLogoUrl: logoUrl,
                primaryColor,
              })
            ),
            tracking: { tenantId: args.tenantId, type: "team_accepted_notification" },
          });
        }

        console.log(`Owner notification sent to ${ownerEmails.length} owner(s)`);
      }
    } catch (error) {
      console.error("Failed to send owner notification:", error);
    }

    return null;
  },
});

/**
 * Get invitation by token (for acceptance flow verification)
 * Used by the invitation acceptance page to pre-fill form
 */
export const getInvitationByToken = query({
  args: {
    token: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("teamInvitations"),
      tenantId: v.id("tenants"),
      email: v.string(),
      role: v.string(),
      expiresAt: v.number(),
      acceptedAt: v.optional(v.number()),
      tenantName: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const invitation = await ctx.db
      .query("teamInvitations")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!invitation) {
      return null;
    }

    // Check if expired
    if (invitation.expiresAt < Date.now()) {
      return null;
    }

    // Check if already accepted
    if (invitation.acceptedAt) {
      return null;
    }

    // Get tenant name for the invitation email
    const tenant = await ctx.db.get(invitation.tenantId);
    const tenantName = tenant?.name || "Your Organization";

    return {
      _id: invitation._id,
      tenantId: invitation.tenantId,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
      acceptedAt: invitation.acceptedAt,
      tenantName,
    };
  },
});

/**
 * Complete invitation acceptance after Better Auth user creation
 * Called by client after successful Better Auth registration
 * 
 * Validates:
 * - Token exists and is valid
 * - Token is not expired
 * - Token has not been used
 * - User doesn't already exist in tenant
 */
export const completeInvitationAcceptance = mutation({
  args: {
    token: v.string(),
    authUserId: v.string(),
    name: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    userId: v.optional(v.id("users")),
    error: v.optional(v.string()),
    errorCode: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    // Step 1: Validate invitation token
    const invitation = await ctx.db
      .query("teamInvitations")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .unique();

    if (!invitation) {
      return {
        success: false,
        error: "Invalid invitation token",
        errorCode: "INVALID_TOKEN",
      };
    }

    // Step 2: Check if invitation has expired
    if (invitation.expiresAt < Date.now()) {
      return {
        success: false,
        error: "Invitation has expired",
        errorCode: "EXPIRED_TOKEN",
      };
    }

    // Step 3: Check if invitation has already been accepted
    if (invitation.acceptedAt) {
      return {
        success: false,
        error: "Invitation has already been used",
        errorCode: "ALREADY_ACCEPTED",
      };
    }

    // Step 4: Check if user already exists in this tenant
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_tenant_and_email", (q) =>
        q.eq("tenantId", invitation.tenantId).eq("email", invitation.email.toLowerCase())
      )
      .first();

    if (existingUser) {
      return {
        success: false,
        error: "A user with this email already exists in this team",
        errorCode: "USER_EXISTS",
      };
    }

    try {
      // Step 5: Create the user record in our database with the auth ID
      const userId = await ctx.db.insert("users", {
        tenantId: invitation.tenantId,
        email: invitation.email.toLowerCase(),
        name: args.name,
        role: invitation.role,
        authId: args.authUserId,
      });

      // Step 6: Mark invitation as accepted
      await ctx.db.patch(invitation._id, {
        acceptedAt: Date.now(),
      });

      // Step 7: Audit logging
      await ctx.db.insert("auditLogs", {
        tenantId: invitation.tenantId,
        action: "team_invitation_accepted",
        entityType: "teamInvitation",
        entityId: invitation._id,
        actorId: userId,
        actorType: "user",
        newValue: {
          email: invitation.email,
          role: invitation.role,
          name: args.name,
        },
      });

      // Step 8: Schedule welcome email and owner notification
      await ctx.scheduler.runAfter(0, internal.teamInvitations.scheduleAcceptanceEmails, {
        invitationId: invitation._id,
        userId,
        tenantId: invitation.tenantId,
        email: invitation.email,
        name: args.name,
        role: invitation.role,
      });

      // Team accepted notification to owners (non-fatal, best-effort)
      try {
        const ownerUsers = await ctx.db
          .query("users")
          .withIndex("by_tenant", (q) => q.eq("tenantId", invitation.tenantId))
          .filter((q) => q.eq(q.field("role") as any, "owner"))
          .take(5);
        for (const owner of ownerUsers) {
          await ctx.runMutation(internal.notifications.createNotification, {
            tenantId: invitation.tenantId,
            userId: owner._id,
            type: "team.accepted",
            title: "Team Member Joined",
            message: `${args.name} (${invitation.email}) has joined the team as ${invitation.role}.`,
            severity: "info",
          });
        }
      } catch (notifErr) {
        console.error("[Notification] Failed to send team accepted notifications:", notifErr);
      }

      return {
        success: true,
        userId,
      };
    } catch (error) {
      console.error("Error accepting invitation:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "An unexpected error occurred",
        errorCode: "INTERNAL_ERROR",
      };
    }
  },
});