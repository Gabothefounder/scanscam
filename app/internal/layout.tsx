import InternalPinGate from "@/app/components/InternalPinGate";

export default function InternalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#13181d",
        color: "#e6edf3",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <InternalPinGate>{children}</InternalPinGate>
    </div>
  );
}
