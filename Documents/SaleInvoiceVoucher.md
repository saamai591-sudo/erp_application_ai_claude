### Sales Invoice — Journal Entry

Implement the following Journal Entry structure for the **Sales Invoice**.

#### Debit Side

**1. Accounts Receivable — Invoice Amount**

* **Ledger Account:** The Accounts Receivable ledger account defined in the Accounting Group of the item's row.
* **Subledger 1, 2 and 4:** If the debit ledger account is linked to the Business Partner at any of its levels, use the Business Partner from the invoice header.
* **Description:** `Sales Invoice + Invoice Number + Date + Business Partner Name`
* **Debit:** Base-currency row amount minus the base-currency discount.
* **Credit:** `0`
* **Currency:** If the row's ledger account is currency-enabled, use the currency selected in the invoice header; otherwise, use the base currency.
* **Foreign Currency Debit:** If the row's ledger account is currency-enabled, use the row amount in the selected currency; otherwise, use the row amount in base currency.
* **Foreign Currency Credit:** `0`

**Aggregation rule:** Aggregate Accounts Receivable entries at the **ledger account + currency** level. However, do **not** aggregate them with the VAT entry.

---

**2. Accounts Receivable — VAT**

* **Ledger Account:** The Accounts Receivable ledger account defined in the Accounting Group of the item's row.
* **Subledger 1, 2 and 4:** If the debit ledger account is linked to the Business Partner at any of its levels, use the Business Partner from the invoice header.
* **Description:** `VAT of Sales Invoice + Invoice Number + Date + Business Partner Name`
* **Debit:** VAT amount in base currency.
* **Credit:** `0`
* **Currency:** Base currency.
* **Foreign Currency Debit:** VAT amount.
* **Foreign Currency Credit:** `0`

**Aggregation rule:** Aggregate entries at the **ledger account** level, but do **not** aggregate them with the Accounts Receivable invoice-amount entry.

---

### Credit Side

**1. Sales Revenue**

* **Ledger Account:** The Sales Revenue ledger account configured for the item's Accounting Group and the **Sales Type** selected in the invoice header.
* **Subledger 1, 2 and 4:** If the ledger account is linked to the Business Partner at any of its levels, use the Business Partner from the invoice header.
* **Description:** `Sales Invoice + Invoice Number + Date + Business Partner Name`
* **Debit:** `0`
* **Credit:** Base-currency row amount minus the base-currency discount.
* **Foreign Currency Debit:** `0`
* **Currency:** If the Sales Revenue ledger account is currency-enabled, use the currency selected in the invoice header; otherwise, use the base currency.
* **Foreign Currency Credit:** If the Sales Revenue ledger account is currency-enabled, use the row amount minus the discount in the selected currency; otherwise, use the base-currency row amount minus the base-currency discount.

**Aggregation rule:** Aggregate entries at the **ledger account** level.

---

**2. VAT**

* **Ledger Account:** The Sales VAT ledger account configured for the item's Accounting Group and the **Sales Type** selected in the invoice header.
* **Subledger 1, 2 and 4:** If the ledger account is linked to the Business Partner at any of its levels, use the Business Partner from the invoice header.
* **Description:** `VAT of Sales Invoice + Invoice Number + Date + Business Partner Name`
* **Debit:** `0`
* **Credit:** VAT amount.
* **Foreign Currency Debit:** `0`
* **Currency:** Base currency.
* **Foreign Currency Credit:** VAT amount.

**Aggregation rule:** Aggregate entries at the **ledger account** level.

---

### General Base-Level Rule for Debit/Credit Direction

Implement this as a **general rule in the Journal Entry base**, not specifically for Sales Invoice:

If an entry is supposed to be **Debit** but the calculated amount is **negative**, reverse its direction and record the amount as positive:

* Negative Debit → **Positive Credit**
* Negative Credit → **Positive Debit**

The same rule must apply wherever Journal Entries are generated throughout the system.
