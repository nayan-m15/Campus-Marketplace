export const APPROVED_UNIVERSITY_EMAILS = [
  { domain: "@students.wits.ac.za", university: "University of the Witwatersrand (Wits)" },
  { domain: "@tuks.co.za", university: "University of Pretoria (UP)" },
  { domain: "@student.uj.ac.za", university: "University of Johannesburg (UJ)" },
  { domain: "@tut4life.ac.za", university: "Tshwane University of Technology (TUT)" },
  { domain: "@vut.ac.za", university: "Vaal University of Technology (VUT)" },
  { domain: "@mylife.unisa.ac.za", university: "UNISA" },
  { domain: "@myuct.ac.za", university: "University of Cape Town (UCT)" },
  { domain: "@sun.ac.za", university: "Stellenbosch University" },
  { domain: "@myuwc.ac.za", university: "University of the Western Cape (UWC)" },
  { domain: "@mycput.ac.za", university: "Cape Peninsula University of Technology (CPUT)" },
  { domain: "@stu.ukzn.ac.za", university: "University of KwaZulu-Natal (UKZN)" },
  { domain: "@dut4life.ac.za", university: "Durban University of Technology (DUT)" },
  { domain: "@mut.ac.za", university: "Mangosuthu University of Technology (MUT)" },
  { domain: "@unizulu.ac.za", university: "University of Zululand" },
  { domain: "@campus.ru.ac.za", university: "Rhodes University" },
  { domain: "@wsu.ac.za", university: "Walter Sisulu University" },
  { domain: "@mandela.ac.za", university: "Nelson Mandela University" },
  { domain: "@ufh.ac.za", university: "University of Fort Hare" },
  { domain: "@ufs.ac.za", university: "University of the Free State (UFS)" },
  { domain: "@cut.ac.za", university: "Central University of Technology (CUT)" },
  { domain: "@mynwu.ac.za", university: "North-West University (NWU)" },
  { domain: "@ul.ac.za", university: "University of Limpopo" },
  { domain: "@ump.ac.za", university: "University of Mpumalanga" },
  { domain: "@spu.ac.za", university: "Sol Plaatje University" },
];

export const APPROVED_UNIVERSITY_DOMAINS = APPROVED_UNIVERSITY_EMAILS.map(({ domain }) => domain);

function normaliseEmail(email) {
  return String(email ?? "").trim().toLowerCase();
}

function findApprovedUniversity(email) {
  const sanitisedEmail = normaliseEmail(email);

  if (!sanitisedEmail.includes("@")) return null;

  return (
    APPROVED_UNIVERSITY_EMAILS.find(({ domain }) => sanitisedEmail.endsWith(domain)) || null
  );
}

export function isUniversityEmail(email) {
  return Boolean(findApprovedUniversity(email));
}

export function getUniversityFromEmail(email) {
  return findApprovedUniversity(email)?.university ?? null;
}

export function getVerificationStatus(user) {
  const email = normaliseEmail(user?.email ?? user?.user?.email ?? user?.auth_user?.email ?? "");
  const hasStoredVerification =
    Object.prototype.hasOwnProperty.call(user ?? {}, "is_verified") ||
    Object.prototype.hasOwnProperty.call(user ?? {}, "verified_university");

  if (hasStoredVerification) {
    const isVerified = Boolean(user?.is_verified);
    const verifiedUniversity = isVerified
      ? user?.verified_university?.trim() || getUniversityFromEmail(email)
      : null;

    return {
      email,
      isVerified,
      verifiedUniversity,
    };
  }

  const verifiedUniversity = getUniversityFromEmail(email);

  return {
    email,
    isVerified: Boolean(verifiedUniversity),
    verifiedUniversity,
  };
}
