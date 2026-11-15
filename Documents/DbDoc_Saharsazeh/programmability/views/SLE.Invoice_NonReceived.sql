-----------------------------------------------------------------------

CREATE     VIEW SLE.Invoice_NonReceived
AS 

           SELECT  i.InvoiceID,
				   i.TotalNetPrice,
                   -ISNULL(ipr.Price, 0) -
                   ISNULL(rs.Amount, 0) -
                   ISNULL(rsi.Price, 0) -
                   ISNULL(mnrc.Price, 0) -
                   ISNULL(rsiBasedOnReturnOugGoing.NetPrice,0)-
                   ISNULL(ipay.Amount, 0) -
				   ISNULL(dcni.Amount, 0) +
				   isnull(ps.Amount, 0) +
				   isnull(pcct.Amount,0) +
				   isnull(dcni2.Amount,0) +
				   isnull(TT.Amount,0) +
				   isnull(TT1.Amount,0) done,
                   i.TotalNetPrice - 
                   ISNULL(ipr.Price, 0) -
                   ISNULL(rs.Amount, 0) -
                   ISNULL(rsi.Price, 0) -
                   ISNULL(mnrc.Price, 0) -
                   ISNULL(rsiBasedOnReturnOugGoing.NetPrice,0)-
                   ISNULL(ipay.Amount, 0) -
				   ISNULL(dcni.Amount, 0) +
				   isnull(ps.Amount, 0) +
				   isnull(pcct.Amount,0) +
				   isnull(dcni2.Amount,0) +
				   isnull(TT.Amount,0) +
				   isnull(TT1.Amount,0) 
						 AS NonReceived
           FROM   SLE.Invoice i
                  LEFT JOIN (
                           SELECT r.InvoiceID,
                                  SUM(r.Price) Price
                           FROM   SLE.InvoicePreReceive r
                           GROUP BY
                                  r.InvoiceID
                       ) ipr
                       ON  i.InvoiceID = ipr.InvoiceID
                  LEFT JOIN (
                           SELECT s.InvoiceID,
                                  SUM(Amount+ISNULL(s.Discount,0)) Amount
                           FROM   FIN.ReceiveSubject s
                           WHERE  s.InvoiceID IS NOT NULL
                           GROUP BY
                                  s.InvoiceID
                       ) rs
                       ON  rs.InvoiceID = i.InvoiceID
                  LEFT JOIN (
                           SELECT ii.InvoiceID,
                                  SUM(r.NetPrice) Price
                           FROM   SLE.ReturnedSaleInvoiceItem r
                                  LEFT JOIN SLE.InvoiceItem ii
                                       ON  r.InvoiceItemID = ii.InvoiceItemID
                           WHERE  r.InvoiceItemID IS NOT NULL
                           GROUP BY
                                  ii.InvoiceID
                       ) rsi
                       ON  i.InvoiceID = rsi.InvoiceID
                  LEFT JOIN (
                           SELECT r.InvoiceID,
                                  SUM(r.Amount) Price
                           FROM   cfg.ManualReceipt  r
                           WHERE  r.InvoiceID IS NOT NULL
                           GROUP BY
                                  r.InvoiceID
                       ) mnrc
                       ON  i.InvoiceID = mnrc.InvoiceID

				LEFT JOIN (select InvoiceID,
				                  sum(Amount) as Amount
				           from CFG.DebitCreditNoteItem
						   where [Type] = 1 and InvoiceID is not null
						   group by InvoiceID
						  ) dcni on i.InvoiceID = dcni.InvoiceID
						  
				LEFT JOIN (select DocumentID,
				                  sum(ipi.Amount) as Amount
				           from CFG.InstallmentPayment AS ip
				           INNER JOIN CFG.InstallmentPaymentItem AS ipi
				                     ON ipi.InstallmentPaymentID = ip.InstallmentPaymentID
				           WHERE ip.BaseType=2
				           group BY ip.DocumentID
						  ) ipay on i.InvoiceID = ipay.DocumentID

				LEFT JOIN (select s.InvoiceID,sum(s.Amount) Amount
					from FIN.PaymentSubject s
					join fin.PaymentReceipt a
						on a.PaymentReceiptID = s.PaymentReceiptID
					where s.InvoiceID is not null
					and a.Status <> 2
					group by s.InvoiceID
					) ps on i.InvoiceID = ps.InvoiceID

				LEFT JOIN (select a.InvoiceID,sum(a.Amount) Amount
					from FIN.PettyCashCostItem a
					where a.InvoiceID is not null
					group by a.InvoiceID
					) pcct on i.InvoiceID = pcct.InvoiceID


				LEFT JOIN (select a.InvoiceID,sum(a.Amount) Amount
					from CFG.DebitCreditNoteItem a
					where a.Type = 0 and a.InvoiceID is not null
					group by a.InvoiceID
					) dcni2 on i.InvoiceID = dcni2.InvoiceID

				LEFT JOIN (select a.InvoiceID, SUM(a.Amount) Amount
				from fin.ReceiveSubject a
				INNER JOIN fin.ReceivedCheqe b
					on a.ReceivedCheqeID = b.ReceivedCheqeID
				where b.LastState = 2
				and a.InvoiceID is not null
				group by a.InvoiceID 
					)TT on TT.InvoiceID = i.InvoiceID

				LEFT JOIN (select c.InvoiceID, SUM(c.Price) Amount
				from fin.ReceiveSubject a
				INNER JOIN fin.ReceivedCheqe b
					on a.ReceivedCheqeID = b.ReceivedCheqeID
				INNER JOIN sle.InvoicePreReceive c
					on c.ReceiveSubjectID = a.ReceiveSubjectID
				where b.LastState = 2
					group by c.InvoiceID 
					)TT1 on TT1.InvoiceID = i.InvoiceID
					
					LEFT JOIN (
						SELECT a.InvoiceID,SUM(rsii.NetPrice) NetPrice
  FROM sle.ReturnedSaleInvoiceItem AS rsii
JOIN (
SELECT rsii.ReturnedSaleInvoiceItemID,
       ii.InvoiceID
FROM   sle.ReturnedSaleInvoiceItem    AS rsii
       JOIN stc.ReturnedOutgoingItem  AS roi
            ON  roi.ReturnedOutgoingItemID = rsii.ReturnedOutgoingItemID
       JOIN stc.OutgoingItem          AS oi
            ON  oi.OutgoingItemID = roi.OutgoingItemID
       JOIN sle.InvoiceItem           AS ii
            ON  ii.OutgoingItemID = oi.OutgoingItemID
GROUP BY
       rsii.ReturnedSaleInvoiceItemID,
       ii.InvoiceID
 UNION ALL
 
 SELECT rsii.ReturnedSaleInvoiceItemID,
       ii.InvoiceID
FROM   sle.ReturnedSaleInvoiceItem    AS rsii
       JOIN stc.ReturnedOutgoingItem  AS roi
            ON  roi.ReturnedOutgoingItemID = rsii.ReturnedOutgoingItemID
       JOIN stc.OutgoingItem          AS oi
            ON  oi.OutgoingItemID = roi.OutgoingItemID
       JOIN sle.InvoiceItem           AS ii
            ON  oi.InvoiceItemID=ii.InvoiceItemID
GROUP BY
       rsii.ReturnedSaleInvoiceItemID,
       ii.InvoiceID
       
        UNION ALL
 
 SELECT rsii.ReturnedSaleInvoiceItemID,
       ii.InvoiceID
FROM   sle.ReturnedSaleInvoiceItem    AS rsii
       JOIN stc.ReturnedOutgoingItem  AS roi
            ON  roi.ReturnedOutgoingItemID = rsii.ReturnedOutgoingItemID
       JOIN stc.OutgoingItem          AS oi
            ON  oi.OutgoingItemID = roi.OutgoingItemID
		JOIN sle.RemittanceItem AS ri ON oi.RemittanceItemID=ri.RemittanceItemID            
       JOIN sle.InvoiceItem           AS ii
            ON  ri.InvoiceItemID=ii.InvoiceItemID
GROUP BY
       rsii.ReturnedSaleInvoiceItemID,
       ii.InvoiceID) a ON a.ReturnedSaleInvoiceItemID = rsii.ReturnedSaleInvoiceItemID

GROUP BY a.InvoiceID) rsiBasedOnReturnOugGoing
ON i.InvoiceID=rsiBasedOnReturnOugGoing.InvoiceID;

