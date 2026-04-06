import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../context/AuthContext";
import "../styles/ProfilePage.css";

// ── Institutions by Province ─────────────────────────────────
const INSTITUTIONS_BY_PROVINCE = {
  "Gauteng": {
    public: [
      "University of the Witwatersrand (Wits)",
      "University of Pretoria (UP)",
      "University of Johannesburg (UJ)",
      "Tshwane University of Technology (TUT)",
      "Vaal University of Technology (VUT)",
      "UNISA",
    ],
    private: [
      "Varsity College (Johannesburg / Pretoria)",
      "Rosebank College (Johannesburg)",
      "Boston City Campus (Johannesburg / Pretoria)",
      "Damelin (Johannesburg / Pretoria)",
      "IIE MSA (Midrand / Sandton)",
      "Richfield Graduate Institute (Johannesburg)",
      "Regent Business School (Johannesburg)",
      "Milpark Business School",
      "Regenesys Business School",
      "MANCOSA (Johannesburg)",
      "SACAP (Johannesburg)",
      "Pearson Institute of Higher Education",
      "Vega School (Johannesburg)",
      "DC Academy",
      "The Animation School (Johannesburg)",
      "Academy of Learning (Johannesburg)",
    ],
  },
  "Western Cape": {
    public: [
      "University of Cape Town (UCT)",
      "Stellenbosch University",
      "University of the Western Cape (UWC)",
      "Cape Peninsula University of Technology (CPUT)",
    ],
    private: [
      "Varsity College (Cape Town)",
      "Rosebank College (Cape Town)",
      "Boston City Campus (Cape Town)",
      "Damelin (Cape Town)",
      "Red & Yellow Creative School",
      "Open Window School of Visual Communication",
      "Inscape Design College (Cape Town)",
      "Greenside Design Center (Cape Town)",
      "AFDA (Cape Town)",
      "Cornerstone Institute",
      "CityVarsity",
      "SACAP (Cape Town)",
      "IMM Graduate School (Cape Town)",
    ],
  },
  "KwaZulu-Natal": {
    public: [
      "University of KwaZulu-Natal (UKZN)",
      "Durban University of Technology (DUT)",
      "Mangosuthu University of Technology (MUT)",
      "University of Zululand",
    ],
    private: [
      "Varsity College (Durban / Westville)",
      "Rosebank College (Durban)",
      "Boston City Campus (Durban)",
      "Damelin (Durban)",
      "Richfield Graduate Institute (Durban)",
      "MANCOSA (Durban)",
      "SACAP (Durban)",
      "IMM Graduate School (Durban)",
    ],
  },
  "Eastern Cape": {
    public: [
      "Rhodes University",
      "Walter Sisulu University",
      "Nelson Mandela University",
      "University of Fort Hare",
    ],
    private: [
      "Varsity College (East London / Port Elizabeth)",
      "Boston City Campus (Port Elizabeth)",
      "Damelin (Port Elizabeth)",
      "Richfield Graduate Institute (East London)",
    ],
  },
  "Free State": {
    public: [
      "University of the Free State (UFS)",
      "Central University of Technology (CUT)",
    ],
    private: [
      "Varsity College (Bloemfontein)",
      "Boston City Campus (Bloemfontein)",
      "Damelin (Bloemfontein)",
      "Academy of Learning (Bloemfontein)",
    ],
  },
  "North West": {
    public: [
      "North-West University (NWU)",
    ],
    private: [
      "Varsity College (Potchefstroom)",
      "Boston City Campus (Rustenburg)",
      "Academy of Learning (Rustenburg)",
    ],
  },
  "Limpopo": {
    public: [
      "University of Limpopo",
    ],
    private: [
      "Boston City Campus (Polokwane)",
      "Richfield Graduate Institute (Polokwane)",
      "Academy of Learning (Polokwane)",
    ],
  },
  "Mpumalanga": {
    public: [
      "University of Mpumalanga",
    ],
    private: [
      "Boston City Campus (Nelspruit)",
      "Academy of Learning (Nelspruit)",
    ],
  },
  "Northern Cape": {
    public: [
      "Sol Plaatje University",
    ],
    private: [
      "Academy of Learning (Kimberley)",
    ],
  },
};

const PROVINCES = Object.keys(INSTITUTIONS_BY_PROVINCE);

// ── Profile completion config ────────────────────────────────
const COMPLETION_FIELDS = [
  { key: "avatar", label: "Profile photo" },
  { key: "name", label: "Full name" },
  { key: "display_name", label: "Display name" },
  { key: "about", label: "About you" },
  { key: "province", label: "Province" },
  { key: "institution", label: "Institution" },
  { key: "birthdate", label: "Date of birth" },
  { key: "sex", label: "Sex" },
  { key: "phone", label: "Phone number" },
];

// ── Completion Bar ───────────────────────────────────────────
function CompletionBar({ form, avatarPreview }) {
  const filled = COMPLETION_FIELDS.filter(({ key }) => {
    if (key === "avatar") return !!avatarPreview;
    return !!form[key];
  });
  const pct = Math.round((filled.length / COMPLETION_FIELDS.length) * 100);
  const color = pct < 40 ? "#ef4444" : pct < 75 ? "#f4a120" : "#16a34a";
  const missing = COMPLETION_FIELDS.filter(({ key }) => {
    if (key === "avatar") return !avatarPreview;
    return !form[key];
  });

  return (
    <div className="profile-completion">
      <div className="profile-completion__header">
        <span className="profile-completion__label">Profile completeness</span>
        <span className="profile-completion__pct" style={{ color }}>{pct}%</span>
      </div>
      <div className="profile-completion__track">
        <div
          className="profile-completion__fill"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      {missing.length > 0 && (
        <p className="profile-completion__hint">
          Still missing: {missing.map((f) => f.label).join(", ")}
        </p>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────
export default function ProfilePage({ onBack, onAvatarChange }) {
  const { user } = useAuth();
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [memberSince, setMemberSince] = useState(null);

  const [form, setForm] = useState({
    name: "",
    display_name: "",
    about: "",
    province: "",
    institution: "",
    birthdate: "",
    sex: "",
    phone: "",
  });

  // Institutions available for the selected province
  const provinceData = INSTITUTIONS_BY_PROVINCE[form.province];
  const availableInstitutions = provinceData
    ? [
        { group: "Public Universities", items: provinceData.public },
        { group: "Private Colleges & Universities", items: provinceData.private },
      ]
    : [];

  // Load profile on mount
  useEffect(() => {
    if (!user) return;

    if (user.created_at) {
      setMemberSince(
        new Date(user.created_at).toLocaleDateString("en-ZA", {
          month: "long",
          year: "numeric",
        })
      );
    }

    supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setForm({
            name: data.name || "",
            display_name: data.display_name || "",
            about: data.about || "",
            province: data.province || "",
            institution: data.institution || "",
            birthdate: data.birthdate || "",
            sex: data.sex || "",
            phone: data.phone || "",
          });
          if (data.avatar_url) setAvatarPreview(data.avatar_url);
        }
        setLoading(false);
      });
  }, [user]);

  // Clear institution when province changes
  const handleProvinceChange = (val) => {
    setForm((f) => ({ ...f, province: val, institution: "" }));
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setAvatarPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    try {
      let avatarUrl = avatarPreview;

      if (avatarFile) {
        const ext = avatarFile.name.split(".").pop();
        const filePath = `${user.id}/avatar.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(filePath, avatarFile, { upsert: true });

        if (uploadError) throw new Error("Avatar upload failed: " + uploadError.message);

        const { data: urlData } = supabase.storage
          .from("avatars")
          .getPublicUrl(filePath);

        avatarUrl = urlData.publicUrl + `?t=${Date.now()}`;
        setAvatarPreview(avatarUrl);
        setAvatarFile(null);
        onAvatarChange?.(avatarUrl);
      }

      const { error } = await supabase.from("profiles").upsert(
        {
          id: user.id,
          name: form.name.trim() || null,
          display_name: form.display_name.trim() || null,
          about: form.about.trim() || null,
          province: form.province || null,
          institution: form.institution || null,
          birthdate: form.birthdate || null,
          sex: form.sex || null,
          phone: form.phone.trim() || null,
          avatar_url: avatarUrl || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

      if (error) throw new Error(error.message);
      showToast("✅ Profile saved!");
    } catch (err) {
      showToast("⚠️ " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const initials = (form.name || user?.email || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  if (loading) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gray-400)" }}>
        Loading profile…
      </div>
    );
  }

  return (
    <div className="profile-page">
      {toast && <div className="profile-toast">{toast}</div>}

      <div className="profile-page__inner">
        <button className="profile-page__back" onClick={onBack}>← Back</button>

        {/* Completion bar */}
        <div className="profile-card">
          <div style={{ padding: "20px 32px" }}>
            <CompletionBar form={form} avatarPreview={avatarPreview} />
          </div>
        </div>

        <div className="profile-card">
          {/* Avatar header */}
          <div className="profile-card__avatar-section">
            <div className="profile-card__avatar-wrap">
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar" className="profile-card__avatar" />
              ) : (
                <div className="profile-card__avatar-placeholder">{initials}</div>
              )}
              <button
                className="profile-card__avatar-btn"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Change profile photo"
                type="button"
              >
                📷
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: "none" }}
                onChange={handleAvatarChange}
              />
            </div>

            <div className="profile-card__avatar-info">
              <h2>{form.display_name || form.name || "Your Profile"}</h2>
              <p>{user?.email}</p>
              {memberSince && (
                <p style={{ fontSize: 12, color: "var(--gray-400)", marginTop: 4 }}>
                  🗓 Member since {memberSince}
                </p>
              )}
            </div>
          </div>

          {/* Form body */}
          <div className="profile-card__body">

            <p className="profile-section-title">Personal</p>

            <div className="profile-field-row">
              <div className="profile-field">
                <label htmlFor="pf-name">Full name</label>
                <input
                  id="pf-name"
                  type="text"
                  placeholder="Your full name"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  maxLength={80}
                />
              </div>
              <div className="profile-field">
                <label htmlFor="pf-display">Display name</label>
                <input
                  id="pf-display"
                  type="text"
                  placeholder="Shown on listings"
                  value={form.display_name}
                  onChange={(e) => set("display_name", e.target.value)}
                  maxLength={40}
                />
              </div>
            </div>

            <div className="profile-field-row">
              <div className="profile-field">
                <label htmlFor="pf-sex">Sex</label>
                <select id="pf-sex" value={form.sex} onChange={(e) => set("sex", e.target.value)}>
                  <option value="">Select…</option>
                  <option>Male</option>
                  <option>Female</option>
                  <option>Prefer not to say</option>
                </select>
              </div>
              <div className="profile-field">
                <label htmlFor="pf-birthdate">Date of birth</label>
                <input
                  id="pf-birthdate"
                  type="date"
                  value={form.birthdate}
                  onChange={(e) => set("birthdate", e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                />
              </div>
            </div>

            <div className="profile-field">
              <label htmlFor="pf-about">About you</label>
              <textarea
                id="pf-about"
                placeholder="A short bio — what you're studying, what you sell, anything buyers should know…"
                value={form.about}
                onChange={(e) => set("about", e.target.value)}
                maxLength={300}
              />
              <span className="profile-field__hint">{form.about.length}/300</span>
            </div>

            <p className="profile-section-title">Location & Institution</p>

            <div className="profile-field-row">
              <div className="profile-field">
                <label htmlFor="pf-province">Province</label>
                <select
                  id="pf-province"
                  value={form.province}
                  onChange={(e) => handleProvinceChange(e.target.value)}
                >
                  <option value="">Select province…</option>
                  {PROVINCES.map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>

              <div className="profile-field">
                <label htmlFor="pf-institution">
                  University / College
                  {!form.province && (
                    <span style={{ fontWeight: 400, color: "#bbb", marginLeft: 6 }}>
                      (select province first)
                    </span>
                  )}
                </label>
                <select
                  id="pf-institution"
                  value={form.institution}
                  onChange={(e) => set("institution", e.target.value)}
                  disabled={!form.province}
                >
                  <option value="">
                    {form.province ? "Select institution…" : "Select province first"}
                  </option>
                  {availableInstitutions.map(({ group, items }) => (
                    <optgroup key={group} label={group}>
                      {items.map((i) => <option key={i}>{i}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>

            <p className="profile-section-title">Contact</p>

            <div className="profile-field-row">
              <div className="profile-field">
                <label htmlFor="pf-email">Email</label>
                <input id="pf-email" type="email" value={user?.email || ""} readOnly />
                <span className="profile-field__hint">Managed via your login</span>
              </div>
              <div className="profile-field">
                <label htmlFor="pf-phone">Phone number</label>
                <input
                  id="pf-phone"
                  type="tel"
                  placeholder="e.g. 071 234 5678"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  maxLength={15}
                />
              </div>
            </div>

          </div>

          <div className="profile-card__footer">
            <button className="profile-save-btn" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save profile"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}