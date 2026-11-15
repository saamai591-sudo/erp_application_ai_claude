
CREATE   VIEW NOC.VWTraceOfPurchaseInvoice_Vat
	as

WITH vp as
     (
         SELECT VoucherID,
                PrevoucherID
         FROM   acc.VoucherPrevoucher
         GROUP BY
                VoucherID,
                PrevoucherID
     ) 

SELECT PurchaseInvoiceID,
       v.VoucherID,
       a.SlID,
       convert(FLOAT, DonePrice) / convert(FLOAT, SUM(DonePrice) over(PARTITION by PurchaseInvoiceID)) Share,
       Title2,
       a.AccruePreVoucherID,
       DonePrice,
       CurrencyID,
	   HasConfirmStatement
FROM   (
           SELECT h.PurchaseInvoiceID,
                  case when HasConfirmStatement = 0 then h.PreVoucherID else  cpi.PreVoucherID end   AccruePreVoucherID,
                  taxslid          SlID,
                  TotalTax         DonePrice,
                  CurrencyID,
				  HasConfirmStatement
           FROM   vnd.PurchaseInvoice h
			JOIN vnd.PurchaseType t
				ON  t.PurchaseTypeID = h.Type
			left join vnd.ConfirmPurchaseInvoice cpi
				on cpi.PurchaseInvoiceID = h.PurchaseInvoiceID
           WHERE  TotalTax > 0 
           
           UNION all
           
           SELECT h.PurchaseInvoiceID,
                  case when HasConfirmStatement = 0 then h.PreVoucherID else  cpi.PreVoucherID end   AccruePreVoucherID,
                  dutyslid SlID,
                  TotalDuty,
                  CurrencyID,
				  HasConfirmStatement
           FROM   vnd.PurchaseInvoice h
            JOIN vnd.PurchaseType t
                ON  t.PurchaseTypeID = h.Type
			left join vnd.ConfirmPurchaseInvoice cpi
				on cpi.PurchaseInvoiceID = h.PurchaseInvoiceID
           WHERE  TotalDuty > 0 
       )A
       JOIN acc.sl
            ON  sl.SlID = a.SlID
       JOIN vp v
            ON  v.PrevoucherID = a.AccruePreVoucherID
