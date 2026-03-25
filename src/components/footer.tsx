"use client";

export function Footer() {
  return (
    <footer className="w-full border-t border-border text-sm text-muted-foreground">
      <div className="mx-auto w-full max-w-6xl px-2 md:px-4 py-4 flex items-center justify-center">
        <p className="text-center">
          © {new Date().getFullYear()} Salig Affiliate
        </p>
      </div>
    </footer>
  );
}
