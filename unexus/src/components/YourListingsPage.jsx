import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "../context/AuthContext";
import { CONDITION_COLORS } from "../data/listings";

export default function YourListingsPage({ onBack }) {
  const { user } = useAuth();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    if (!user) return;
    fetchUserListings();
  }, [user]);

  async function fetchUserListings() {
    setLoading(true);
    const { data, error } = await supabase
      .from("listings")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) setError(error.message);
    else setListings(data || []);
    setLoading(false);
  }

  async function handleDelete(id) {
    const { error } = await supabase.from("listings").delete().eq("id", id);
    if (error) { setError(error.message); return; }
    setListings((prev) => prev.filter((l) => l.id !== id));
    setDeleteConfirm(null);
    showSuccess("Listing deleted.");
  }

  async function handleMarkSold(id, currentStatus) {
    const newStatus = currentStatus === "sold" ? "active" : "sold";
    const { error } = await supabase
      .from("listings")
      .update({ status: newStatus })
      .eq("id", id);
    if (error) { setError(error.message); return; }
    setListings((prev) =>
      prev.map((l) => (l.id === id ? { ...l, status: newStatus } : l))
    );
    showSuccess(newStatus === "sold" ? "Marked as sold!" : "Relisted!");
  }
  async function handleMarkTrade(id, currentStatus) {
  const newStatus = currentStatus === "for_trade" ? "active" : "for_trade";
  const { error } = await supabase
    .from("listings")
    .update({ status: newStatus })
    .eq("id", id);
  if (error) { setError(error.message); return; }
  setListings((prev) =>
    prev.map((l) => (l.id === id ? { ...l, status: newStatus } : l))
  );
  showSuccess(newStatus === "for_trade" ? "Listed for trade!" : "Relisted!");
}

  async function handleEditSave(e) {
    e.preventDefault();
    const { id, title, price, condition, description, category } = editingItem;
    const { error } = await supabase
      .from("listings")
      .update({ title, price, condition, description, category })
      .eq("id", id);
    if (error) { setError(error.message); return; }
    setListings((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...editingItem } : l))
    );
    setEditingItem(null);
    showSuccess("Listing updated!");
  }

  function showSuccess(msg) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(""), 3000);
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface-muted)", padding: "32px 40px", fontFamily: "var(--font)" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
        <button
          onClick={onBack}
          style={{ background: "none", border: "1px solid var(--gray-200)", borderRadius: 9, padding: "8px 16px", cursor: "pointer", fontSize: 14, color: "var(--gray-800)", fontFamily: "var(--font)" }}
        >
          ← Back
        </button>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--gray-900)", margin: 0 }}>Your Listings</h1>
        {listings.length > 0 && (
          <span style={{ background: "var(--mint)", color: "var(--green)", borderRadius: 20, padding: "4px 12px", fontSize: 13, fontWeight: 600 }}>
            {listings.length} listing{listings.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Success toast */}
      {successMsg && (
        <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", background: "var(--gray-900)", color: "#fff", padding: "12px 24px", borderRadius: 10, fontWeight: 600, fontSize: 14, zIndex: 9999, boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>
          {successMsg}
        </div>
      )}

      {/* Error */}
      {error && (
        <p style={{ color: "crimson", marginBottom: 16 }}>{error}</p>
      )}

      {/* Loading */}
      {loading && <p style={{ color: "var(--gray-600)" }}>Loading your listings…</p>}

      {/* Empty state */}
      {!loading && listings.length === 0 && (
        <div style={{ textAlign: "center", padding: "80px 0", color: "var(--gray-600)" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📦</div>
          <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No listings yet</p>
          <p style={{ fontSize: 14 }}>Click "+ List Item" in the navbar to create your first listing.</p>
        </div>
      )}

      {/* Listings grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 24 }}>
        {listings.map((item) => {
          const conditionColor = CONDITION_COLORS[item.condition] || "#6b7280";
          const isSold = item.status === "sold";

          return (
            <article key={item.id} style={{ background: "var(--surface)", borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.07)", border: "1px solid var(--gray-200)", opacity: isSold ? 0.7 : 1, position: "relative" }}>

              {/* Status badge */}
                {item.status && item.status !== "active" && (
                  <div style={{
                    position: "absolute", top: 12, left: 12, zIndex: 1,
                    background: item.status === "sold" ? "#111" : "#3b82f6",
                    color: "#fff", borderRadius: 8, padding: "4px 10px",
                    fontSize: 12, fontWeight: 700
                  }}>
                    {item.status === "sold" ? "SOLD" : "FOR TRADE"}
                  </div>
                )}

              {/* Image */}
              <div style={{ height: 160, background: "var(--surface-soft)", overflow: "hidden" }}>
                {item.image_url ? (
                  <img src={item.image_url} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40 }}>
                    {item.emoji || "📦"}
                  </div>
                )}
              </div>

              {/* Details */}
              <div style={{ padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--gray-900)", margin: 0, flex: 1 }}>{item.title}</h3>
                  <span style={{ background: conditionColor + "22", color: conditionColor, borderRadius: 6, padding: "2px 8px", fontSize: 12, fontWeight: 600, marginLeft: 8, whiteSpace: "nowrap" }}>
                    {item.condition}
                  </span>
                </div>

                <p style={{ fontSize: 18, fontWeight: 800, color: "var(--gray-900)", margin: "0 0 4px" }}>{item.price}</p>
                <p style={{ fontSize: 12, color: "var(--gray-600)", margin: "0 0 16px" }}>{item.category}</p>

                {/* Actions */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    onClick={() => setEditingItem({ ...item })}
                    style={{ flex: 1, padding: "8px 12px", borderRadius: 9, border: "1px solid #e5e7eb", background: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font)", color: "var(--gray-800)" }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleMarkSold(item.id, item.status)}
                    style={{ flex: 1, padding: "8px 12px", borderRadius: 9, border: "1px solid #e5e7eb", background: item.status === "sold" ? "#f0fdf4" : "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font)", color: item.status === "sold" ? "var(--green)" : "var(--gray-800)" }}
                  >
                    {item.status === "sold" ? "Relist" : " Mark Sold"}
                  </button>
                  <button
                    onClick={() => handleMarkTrade(item.id, item.status)}
                    style={{ flex: 1, padding: "8px 12px", borderRadius: 9, border: "1px solid #e5e7eb", background: item.status === "for_trade" ? "#eff6ff" : "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font)", color: item.status === "for_trade" ? "#3b82f6" : "var(--gray-800)" }}
                  >
                    {item.status === "for_trade" ? "Unlist Trade" : "For Trade"}
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(item.id)}
                    style={{ padding: "8px 12px", borderRadius: 9, border: "1px solid #fee2e2", background: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font)", color: "#ef4444" }}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
          <div style={{ background: "var(--surface)", borderRadius: 16, padding: 32, maxWidth: 400, width: "90%", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🗑️</div>
            <h3 style={{ fontWeight: 800, marginBottom: 8 }}>Delete this listing?</h3>
            <p style={{ color: "var(--gray-600)", fontSize: 14, marginBottom: 24 }}>This cannot be undone.</p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                style={{ padding: "10px 24px", borderRadius: 9, border: "1px solid var(--gray-200)", background: "var(--surface)", fontWeight: 600, cursor: "pointer", fontFamily: "var(--font)" }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                style={{ padding: "10px 24px", borderRadius: 9, border: "none", background: "var(--danger)", color: "#fff", fontWeight: 600, cursor: "pointer", fontFamily: "var(--font)" }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editingItem && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
          <div style={{ background: "var(--surface)", borderRadius: 16, padding: 32, maxWidth: 480, width: "90%", maxHeight: "90vh", overflowY: "auto" }}>
            <h3 style={{ fontWeight: 800, marginBottom: 24, fontSize: 18 }}>Edit Listing</h3>
            <form onSubmit={handleEditSave} style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--gray-800)" }}>
                Title
                <input
                  value={editingItem.title}
                  onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                  style={{ padding: "10px 14px", borderRadius: 9, border: "1.5px solid var(--gray-200)", fontSize: 14, fontFamily: "var(--font)", outline: "none" }}
                  required
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--gray-800)" }}>
                Price
                <input
                  value={editingItem.price}
                  onChange={(e) => setEditingItem({ ...editingItem, price: e.target.value })}
                  style={{ padding: "10px 14px", borderRadius: 9, border: "1.5px solid var(--gray-200)", fontSize: 14, fontFamily: "var(--font)", outline: "none" }}
                  required
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--gray-800)" }}>
                Condition
                <select
                  value={editingItem.condition}
                  onChange={(e) => setEditingItem({ ...editingItem, condition: e.target.value })}
                  style={{ padding: "10px 14px", borderRadius: 9, border: "1.5px solid var(--gray-200)", fontSize: 14, fontFamily: "var(--font)", outline: "none" }}
                >
                  {["Like New", "Good", "Fair", "Poor"].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--gray-800)" }}>
                Description
                <textarea
                  value={editingItem.description || ""}
                  onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                  rows={3}
                  style={{ padding: "10px 14px", borderRadius: 9, border: "1.5px solid var(--gray-200)", fontSize: 14, fontFamily: "var(--font)", outline: "none", resize: "vertical" }}
                />
              </label>

              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  style={{ flex: 1, padding: "10px", borderRadius: 9, border: "1px solid var(--gray-200)", background: "var(--surface)", fontWeight: 600, cursor: "pointer", fontFamily: "var(--font)" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ flex: 1, padding: "10px", borderRadius: 9, border: "none", background: "var(--green)", color: "#fff", fontWeight: 600, cursor: "pointer", fontFamily: "var(--font)" }}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
