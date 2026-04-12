import { useState } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../context/AuthContext";
import "../styles/ProfileSetup.css";

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
    public: ["North-West University (NWU)"],
    private: [
      "Varsity College (Potchefstroom)",
      "Boston City Campus (Rustenburg)",
      "Academy of Learning (Rustenburg)",
    ],
  },
  "Limpopo": {
    public: ["University of Limpopo"],
    private: [
      "Boston City Campus (Polokwane)",
      "Richfield Graduate Institute (Polokwane)",
      "Academy of Learning (Polokwane)",
    ],
  },
  "Mpumalanga": {
    public: ["University of Mpumalanga"],
    private: [
      "Boston City Campus (Nelspruit)",
      "Academy of Learning (Nelspruit)",
    ],
  },
  "Northern Cape": {
    public: ["Sol Plaatje University"],
    private: ["Academy of Learning (Kimberley)"],
  },
};

const PROVINCES = Object.keys(INSTITUTIONS_BY_PROVINCE);

// ── Step indicator ───────────────────────────────────────────
function StepDots({ current, total }) {
  return (
    <div className="setup-steps">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`setup-step-dot ${i === current ? "setup-step-dot--active" : i < current ? "setup-step-dot--done" : ""}`}
        />
      ))}
    </div>
  );
}

const TOTAL_STEPS = 3;

export default function ProfileSetupPage({ onComplete }) {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    display_name: "",
    sex: "",
    birthdate: "",
    province: "",
    institution: "",
  });

  const set = (key, val) => {
    setError("");
    setForm((f) => ({ ...f, [key]: val }));
  };

  const handleProvinceChange = (val) => {
    setError("");
    setForm((f) => ({ ...f, province: val, institution: "" }));
  };

  const provinceData = INSTITUTIONS_BY_PROVINCE[form.province];
  const availableInstitutions = provinceData
    ? [
        { group: "Public Universities", items: provinceData.public },
        { group: "Private Colleges & Universities", items: provinceData.private },
      ]
    : [];

  // ── Validation per step ──────────────────────────────────
  const validateStep = () => {
    if (step === 0) {
      if (!form.name.trim()) return "Please enter your full name.";
    }
    if (step === 1) {
      if (!form.sex) return "Please select your sex.";
      if (!form.birthdate) return "Please enter your date of birth.";
    }
    if (step === 2) {
      if (!form.province) return "Please select your province.";
      if (!form.institution) return "Please select your institution.";
    }
    return null;
  };

  const handleNext = () => {
    const err = validateStep();
    if (err) { setError(err); return; }
    setError("");
    setStep((s) => s + 1);
  };

  const handleBack = () => {
    setError("");
    setStep((s) => s - 1);
  };

  const handleFinish = async () => {
    const err = validateStep();
    if (err) { setError(err); return; }

    setSaving(true);
    setError("");

    try {
      const displayName = form.display_name.trim() || form.name.trim().split(" ")[0];

      const { error: upsertError } = await supabase.from("profiles").upsert(
        {
          id: user.id,
          name: form.name.trim(),
          display_name: displayName,
          sex: form.sex,
          birthdate: form.birthdate,
          province: form.province,
          institution: form.institution,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

      if (upsertError) throw new Error(upsertError.message);
      onComplete();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="setup-page">
      <div className="setup-card">

        {/* Header */}
        <div className="setup-header">
          <div className="setup-logo">
            <strong className="setup-logo__icon">UX</strong>
            <span className="setup-logo__text">Unexus</span>
          </div>
          <StepDots current={step} total={TOTAL_STEPS} />
          <h1 className="setup-title">
            {step === 0 && "What's your name?"}
            {step === 1 && "A bit about you"}
            {step === 2 && "Where are you studying?"}
          </h1>
          <p className="setup-subtitle">
            {step === 0 && "This helps buyers and sellers know who they're dealing with."}
            {step === 1 && "Just a few quick details to complete your profile."}
            {step === 2 && "We'll show you listings from your campus and province first."}
          </p>
        </div>

        {/* Step content */}
        <div className="setup-body">

          {/* ── Step 0: Name ── */}
          {step === 0 && (
            <>
              <div className="setup-field">
                <label htmlFor="s-name">Full name <span className="setup-required">*</span></label>
                <input
                  id="s-name"
                  type="text"
                  placeholder="e.g. Thabo Mokoena"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  maxLength={80}
                  autoFocus
                />
              </div>
              <div className="setup-field">
                <label htmlFor="s-display">
                  Display name{" "}
                  <span className="setup-optional">(optional — shown on listings)</span>
                </label>
                <input
                  id="s-display"
                  type="text"
                  placeholder={form.name.trim().split(" ")[0] || "e.g. Thabo"}
                  value={form.display_name}
                  onChange={(e) => set("display_name", e.target.value)}
                  maxLength={40}
                />
                <span className="setup-hint">
                  Leave blank to use your first name
                </span>
              </div>
            </>
          )}

          {/* ── Step 1: Sex + Birthdate ── */}
          {step === 1 && (
            <>
              <div className="setup-field">
                <label htmlFor="s-sex">Sex <span className="setup-required">*</span></label>
                <div className="setup-radio-row">
                  {["Male", "Female", "Prefer not to say"].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className={`setup-radio-btn ${form.sex === opt ? "setup-radio-btn--selected" : ""}`}
                      onClick={() => set("sex", opt)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
              <div className="setup-field">
                <label htmlFor="s-birth">Date of birth <span className="setup-required">*</span></label>
                <input
                  id="s-birth"
                  type="date"
                  value={form.birthdate}
                  onChange={(e) => set("birthdate", e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                />
              </div>
            </>
          )}

          {/* ── Step 2: Province + Institution ── */}
          {step === 2 && (
            <>
              <div className="setup-field">
                <label htmlFor="s-province">Province <span className="setup-required">*</span></label>
                <select
                  id="s-province"
                  value={form.province}
                  onChange={(e) => handleProvinceChange(e.target.value)}
                >
                  <option value="">Select province…</option>
                  {PROVINCES.map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div className="setup-field">
                <label htmlFor="s-institution">
                  University / College <span className="setup-required">*</span>
                </label>
                <select
                  id="s-institution"
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
            </>
          )}

          {/* Error */}
          {error && <p className="setup-error" role="alert">⚠️ {error}</p>}
        </div>

        {/* Footer / navigation */}
        <div className="setup-footer">
          {step > 0 && (
            <button type="button" className="setup-btn setup-btn--ghost" onClick={handleBack}>
              ← Back
            </button>
          )}
          {step < TOTAL_STEPS - 1 ? (
            <button type="button" className="setup-btn setup-btn--primary" onClick={handleNext}>
              Continue →
            </button>
          ) : (
            <button
              type="button"
              className="setup-btn setup-btn--primary"
              onClick={handleFinish}
              disabled={saving}
            >
              {saving ? "Saving…" : "Let's go 🎉"}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}