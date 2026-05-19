const INDOCREONIX_LOGO = "https://indocreonix.com/logo.png";

export default function BrandingBar() {
  return (
    <div style={brandingWrap}>
      <div style={innerStyle}>
        <img src={INDOCREONIX_LOGO} alt="IndoCreonix" style={logoStyle} />
        <div style={{ marginLeft: 12 }}>
          <div style={titleStyle}>IndoCreonix</div>
          <div style={subStyle}>
            Digital rights and platform managed by IndoCreonix
          </div>
        </div>
      </div>
    </div>
  );
}

const brandingWrap = {
  width: "100%",
  background: "linear-gradient(90deg,#0b1220,#2b0f00)",
  borderBottom: "1px solid rgba(255,200,0,0.06)",
  padding: "0.45rem 0",
};

const innerStyle = {
  maxWidth: 1300,
  margin: "0 auto",
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "0 1rem",
};

const logoStyle = {
  width: 44,
  height: 44,
  objectFit: "contain",
  borderRadius: 8,
  background: "#fff",
  padding: 6,
};

const titleStyle = {
  color: "#ffd65f",
  fontWeight: 800,
  fontSize: 14,
};

const subStyle = {
  color: "#dfe6ef",
  fontSize: 12,
  marginTop: 2,
};
