
CREATE    VIEW [SLE].ReturnedSaleInvoice_NonPaymented
AS 

    SELECT T.ReturnedSaleInvoiceID,
           T.NonPaymented 
    FROM   (
        SELECT i.ReturnedSaleInvoiceID,
                i.TotalNetPrice - 
                ISNULL(ps.Amount, 0) - 
                ISNULL(pcct.Amount, 0)-
                ISNULL(mnrc.Amount, 0) -
				isnull(dcni.Amount, 0) -
				isnull(RequestItem.Amount, 0)
                AS NonPaymented
        FROM   SLE.ReturnedSaleInvoice i

        LEFT JOIN (
                SELECT s.ReturnedSaleInvoiceID,
                        SUM(Amount) Amount
                FROM   FIN.PaymentSubject s
				join fin.PaymentReceipt a
					on a.PaymentReceiptID = s.PaymentReceiptID
                WHERE  s.ReturnedSaleInvoiceID IS NOT NULL and a.Status <> 2
                GROUP BY
                        s.ReturnedSaleInvoiceID
            ) ps
            ON  ps.ReturnedSaleInvoiceID = i.ReturnedSaleInvoiceID

        LEFT JOIN (
                SELECT p.ReturnedSaleInvoiceID,
                        SUM(Amount) Amount
                FROM   FIN.PettyCashCostItem p
                WHERE  p.ReturnedSaleInvoiceID IS NOT NULL
                GROUP BY
                        p.ReturnedSaleInvoiceID
            ) pcct
            ON  pcct.ReturnedSaleInvoiceID = i.ReturnedSaleInvoiceID

        LEFT JOIN (
                SELECT p.ReturnedSaleInvoiceID,
                        SUM(Amount) Amount
                FROM   cfg.ManualReceipt  p
                WHERE  p.ReturnedSaleInvoiceID IS NOT NULL
                GROUP BY
                        p.ReturnedSaleInvoiceID
        ) mnrc ON  mnrc.ReturnedSaleInvoiceID = i.ReturnedSaleInvoiceID

		LEFT JOIN (
            SELECT ReturnedSaleInvoiceID, 
                sum(Amount) as Amount 
			FROM CFG.DebitCreditNoteItem
			WHERE Type = 0 and ReturnedSaleInvoiceID is not null
			group by ReturnedSaleInvoiceID
		) dcni on i.ReturnedSaleInvoiceID = dcni.ReturnedSaleInvoiceID

        LEFT JOIN (
            SELECT	pri.BaseDocumentID AS ReturnedSaleInvoiceID, 
		            SUM(pri.Amount) AS Amount
            FROM req.PaymentRequestItem pri
            JOIN req.PaymentRequest prh ON pri.PaymentRequestID = prh.PaymentRequestID
            LEFT JOIN req.PaymentOrderItem poi 
	            ON poi.PaymentRequestItemID = pri.PaymentRequestItemID
            LEFT JOIN FIN.PaymentReceipt pr		
	            ON pr.PaymentOrderID = poi.PaymentOrderID
            WHERE pri.BaseDocumentType = 3 AND (poi.PaymentRequestItemID IS NULL 
	            OR pr.PaymentOrderID IS NULL)
	            AND prh.Status NOT IN (3,5)
            GROUP BY pri.BaseDocumentID
        ) AS RequestItem on i.ReturnedSaleInvoiceID = RequestItem.ReturnedSaleInvoiceID
    )T

