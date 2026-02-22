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
    textAlign: "center",
    fontSize: 12,
    color: "#6B7280",
    opacity: 0.8,
    padding: "16px 16px",
  },
  link: {
    color: "#6B7280",
    textDecoration: "none",
  },
};
