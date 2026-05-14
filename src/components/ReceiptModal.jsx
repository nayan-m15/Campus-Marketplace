import { useEffect, useMemo, useRef, useState } from "react";

/*This function formats the receipt date.*/
function formatReceiptDate(timestamp) {
  if (!timestamp) return "Date unavailable";
  return new Date(timestamp).toLocaleString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ReceiptModal({
  transactions,
  generatingId,
  onGenerate,
  onClose,
}) {
  const dialogRef = useRef(null);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (dialogRef.current && !dialogRef.current.open) {
      dialogRef.current.showModal();
    }
  }, []);

  const filteredTransactions = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return transactions;

    return transactions.filter((transaction) => {
      const haystack = [
        transaction.id,
        transaction.item,
        transaction.seller?.name,
        transaction.buyer?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(needle);
    });
  }, [search, transactions]);

  const selectedTransaction = useMemo(
    () => transactions.find((transaction) => transaction.id === selectedId) || null,
    [selectedId, transactions],
  );

  /*This function handles closing the view.*/
  function handleClose() {
    if (!generatingId) onClose();
  }

  /*This function handles receipt download requests.*/
  async function handleGenerateClick() {
    if (!selectedTransaction) {
      setError("Select a transaction before generating a receipt.");
      return;
    }

    setError("");
    await onGenerate(selectedTransaction);
  }

  return (
    <dialog ref={dialogRef} className="receipt-dialog" onClose={handleClose}>
      <article className="receipt-dialog__inner">
        <header className="receipt-dialog__header">
          <section>
            <p className="receipt-dialog__eyebrow">CampusXchange</p>
            <h2 className="receipt-dialog__title">Generate Transaction Receipt</h2>
            <p className="receipt-dialog__subtitle">
              Search the ledger, choose one transaction, then download a styled PDF receipt.
            </p>
          </section>
          <button
            type="button"
            className="receipt-dialog__close"
            onClick={handleClose}
            aria-label="Close receipt generator"
            disabled={Boolean(generatingId)}
          >
            x
          </button>
        </header>

        <article className="receipt-dialog__body">
          <article className="receipt-dialog__toolbar">
            <label htmlFor="receipt-transaction-search" className="sr-only">
              Search transactions
            </label>
            <input
              id="receipt-transaction-search"
              type="search"
              className="bookings-search"
              placeholder="Search by transaction ID, item, buyer or seller..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <span className="receipt-dialog__results">
              {filteredTransactions.length} result{filteredTransactions.length === 1 ? "" : "s"}
            </span>
          </article>

          <article className="receipt-dialog__content">
            <section className="receipt-dialog__list" aria-label="Transactions available for receipt generation">
              {filteredTransactions.length === 0 ? (
                <article className="receipt-dialog__empty">
                  No matching transactions found. Try a different search term.
                </article>
              ) : (
                filteredTransactions.map((transaction) => {
                  const isSelected = selectedId === transaction.id;
                  const isItemTrade = transaction.transaction_type === "item_trade" || Boolean(transaction.offered_listing_id);
                  return (
                    <button
                      key={transaction.id}
                      type="button"
                      className={`receipt-option ${isSelected ? "receipt-option--selected" : ""}`}
                      onClick={() => {
                        setSelectedId(transaction.id);
                        setError("");
                      }}
                    >
                      <article className="receipt-option__top">
                        <span className="txn-id-chip">{transaction.id}</span>
                        <span className="receipt-option__price">
                          {isItemTrade ? "Item trade" : `R ${Number(transaction.totalAmount ?? transaction.price ?? 0).toLocaleString("en-ZA")}`}
                        </span>
                      </article>
                      <p className="receipt-option__item">{transaction.item}</p>
                      <p className="receipt-option__meta">
                        Seller: {transaction.seller?.name || "Unknown"} | Buyer: {transaction.buyer?.name || "Unknown"}
                      </p>
                      <p className="receipt-option__meta">
                        {formatReceiptDate(transaction.createdAt)} | {transaction.status}
                      </p>
                    </button>
                  );
                })
              )}
            </section>

            <aside className="receipt-preview" aria-live="polite">
              <p className="receipt-preview__label">Selected Transaction</p>
              {selectedTransaction ? (
                <>
                  <h3 className="receipt-preview__title">{selectedTransaction.item}</h3>
                  <dl className="receipt-preview__details">
                    <section>
                      <dt>Transaction ID</dt>
                      <dd>{selectedTransaction.id}</dd>
                    </section>
                    <section>
                      <dt>Buyer</dt>
                      <dd>{selectedTransaction.buyer?.name || "Unknown"}</dd>
                    </section>
                    <section>
                      <dt>Seller</dt>
                      <dd>{selectedTransaction.seller?.name || "Unknown"}</dd>
                    </section>
                    <section>
                      <dt>{selectedTransaction.transaction_type === "item_trade" ? "Trade" : "Amount"}</dt>
                      <dd>
                        {selectedTransaction.transaction_type === "item_trade"
                          ? `${selectedTransaction.requested_item || "Listed item"} for ${selectedTransaction.offered_item || "offered item"}`
                          : `R ${Number(selectedTransaction.totalAmount ?? selectedTransaction.price ?? 0).toLocaleString("en-ZA")}`}
                      </dd>
                    </section>
                    <section>
                      <dt>Status</dt>
                      <dd>{selectedTransaction.status}</dd>
                    </section>
                    <section>
                      <dt>Has image</dt>
                      <dd>{selectedTransaction.itemImageUrl ? "Yes" : "No"}</dd>
                    </section>
                  </dl>
                  <p className="receipt-preview__description">
                    {selectedTransaction.itemDescription || "No stored description is available for this item."}
                  </p>
                </>
              ) : (
                <p className="receipt-preview__placeholder">
                  Choose a transaction from the list to preview the receipt details.
                </p>
              )}
            </aside>
          </article>

          {error ? <p className="receipt-dialog__error" role="alert">{error}</p> : null}
        </article>

        <footer className="receipt-dialog__footer">
          <button type="button" className="btn-export" onClick={handleClose} disabled={Boolean(generatingId)}>
            Cancel
          </button>
          <button type="button" className="btn-primary" onClick={handleGenerateClick} disabled={Boolean(generatingId)}>
            {generatingId ? "Generating..." : "Download Receipt"}
          </button>
        </footer>
      </article>
    </dialog>
  );
}
