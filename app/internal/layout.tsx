export default function InternalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f1419",
        color: "#e6edf3",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      {children}
    </div>
  );
}
