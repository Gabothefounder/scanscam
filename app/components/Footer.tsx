export default function Footer() {
  return (
    <footer style={styles.footer}>
      <span>© ScanScam 2026 · </span>
      <a href="mailto:hello@scanscam.ca" style={styles.link}>
        hello@scanscam.ca
      </a>
    </footer>
  );
}

const styles: Record<string, React.CSSProperties> = {
  footer: {
    width: "100%",
    textAlign: "center",
    fontSize: 12,
    color: "#6B7280",
    padding: "16px 24px",
    backgroundColor: "#FFFFFF",
    boxSizing: "border-box",
  },
  link: {
    color: "#6B7280",
    textDecoration: "none",
  },
};
