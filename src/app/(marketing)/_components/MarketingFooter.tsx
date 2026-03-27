import Link from "next/link";
import { Shield, Lock, Zap } from "lucide-react";
import { Logo } from "@/components/shared/Logo";

const currentYear = new Date().getFullYear();

const footerLinks = {
  product: [
    { label: "Features", href: "#features" },
    { label: "Pricing", href: "#pricing" },
    { label: "Log in", href: "/sign-in" },
    { label: "Sign up", href: "/sign-up" },
  ],
  company: [
    { label: "About", href: "#" },
    { label: "Blog", href: "#" },
    { label: "Contact", href: "mailto:hello@saligaffiliate.com" },
  ],
  legal: [
    { label: "Privacy Policy", href: "#" },
    { label: "Terms of Service", href: "#" },
    { label: "Cookie Policy", href: "#" },
  ],
};

export function MarketingFooter() {
  return (
    <footer className="bg-[#022232] text-white pt-20 pb-8 relative overflow-hidden">
      {/* Background accent */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 lg:gap-16 mb-16">
          {/* Brand Column */}
          <div className="col-span-2 md:col-span-1">
            <Logo href="/" variant="light" />
            <p className="text-white/60 text-base mb-6 leading-relaxed">
              Launch, manage, and pay your affiliate program natively on SaligPay.
            </p>
            <div className="flex items-center gap-4 text-sm text-white/50">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#22d3ee]" />
                <span>Built on SaligPay</span>
              </div>
            </div>
          </div>

          {/* Product Links */}
          <div>
            <h4 className="font-bold text-white mb-5 text-sm uppercase tracking-wider">Product</h4>
            <ul className="space-y-4">
              {footerLinks.product.map((link, index) => (
                <li key={index}>
                  <Link 
                    href={link.href}
                    className="text-white/60 hover:text-white transition-colors text-sm font-medium inline-block"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company Links */}
          <div>
            <h4 className="font-bold text-white mb-5 text-sm uppercase tracking-wider">Company</h4>
            <ul className="space-y-4">
              {footerLinks.company.map((link, index) => (
                <li key={index}>
                  <Link 
                    href={link.href}
                    className="text-white/60 hover:text-white transition-colors text-sm font-medium inline-block"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h4 className="font-bold text-white mb-5 text-sm uppercase tracking-wider">Legal</h4>
            <ul className="space-y-4">
              {footerLinks.legal.map((link, index) => (
                <li key={index}>
                  <Link 
                    href={link.href}
                    className="text-white/60 hover:text-white transition-colors text-sm font-medium inline-block"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-white/10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <p className="text-sm text-white/40">
              © {currentYear} salig-affiliate. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 text-sm text-white/40">
                <Lock className="w-4 h-4" />
                <span>Secure payments</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-white/40">
                <Zap className="w-4 h-4 text-[#22d3ee]" />
                <span>Powered by SaligPay</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}