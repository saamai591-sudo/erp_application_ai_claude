
CREATE   VIEW [SLE].[Invoice_Return_Remains]

AS
   
SELECT ii.InvoiceItemID,
       MainQuantity,
       T.DoMainQuantity,
       T.DoSubQuantity,
	   MainQuantity -DoMainQuantity  AS Non,
	   SubQuantity -DoSubQuantity AS NonSub
FROM   (
           SELECT ii.InvoiceItemID,
                  SUM(ISNULL(ri.MainQuantity, 0) + ISNULL(oi.MainQuantity, 0)+ISNULL(a.MainQuantity,0)) AS DoMainQuantity,
                  SUM(ISNULL(ri.SubQuantity, 0) + ISNULL(oi.SubQuantity, 0)+ISNULL(a.SubQuantity,0)) AS DoSubQuantity
           FROM   sle.InvoiceItem AS ii
            LEFT JOIN (
					SELECT 
							InvoiceItemID,
                            SUM(MainQuantity) AS MainQuantity,
                            SUM(SubQuantity) AS SubQuantity
					FROM SLE.ReturnedSaleJustificationItem
					GROUP BY InvoiceItemID                  
            ) AS oi
                       ON  oi.InvoiceItemID = ii.InvoiceItemID
            LEFT JOIN (
					SELECT 
							InvoiceItemID,
                            SUM(MainQuantity) AS MainQuantity,
                            SUM(SubQuantity) AS SubQuantity
					FROM SLE.ReturnedSaleInvoiceItem
					GROUP BY InvoiceItemID                  
            ) AS ri
                       ON  ri.InvoiceItemID = ii.InvoiceItemID
            LEFT JOIN (SELECT InDirectInvoiceReturn.InvoiceItemID,
							   SUM(InDirectInvoiceReturn.MainQuantity) MainQuantity,
							   SUM(InDirectInvoiceReturn.SubQuantity) SubQuantity
							FROM   (
									   SELECT ii.InvoiceItemID,
											  ret.MainQuantity,
											  ret.SubQuantity
									   FROM   sle.InvoiceItem        AS ii
											  JOIN stc.OutgoingItem  AS oi
												   ON  oi.OutgoingItemID = ii.OutgoingItemId
											  JOIN (
													   SELECT roi.OutgoingItemID,
															  SUM(roi.MainQuantity) MainQuantity,
															  SUM(roi.SubQuantity) SubQuantity
													   FROM   stc.ReturnedOutgoingItem AS roi
													   GROUP BY
															  roi.OutgoingItemID
												   ) ret
												   ON  oi.OutgoingItemID = ret.OutgoingItemID
									   UNION ALL 
									   SELECT oi.InvoiceItemID,
											  SUM(ret.MainQuantity),
											  SUM(ret.SubQuantity)
									   FROM   stc.OutgoingItem AS oi
											  JOIN (
													   SELECT roi.OutgoingItemID,
															  SUM(roi.MainQuantity) MainQuantity,
															  SUM(roi.SubQuantity) SubQuantity
													   FROM   stc.ReturnedOutgoingItem AS roi
													   GROUP BY
															  roi.OutgoingItemID
												   ) ret
												   ON  oi.OutgoingItemID = ret.OutgoingItemID
									   WHERE  oi.InvoiceItemID IS NOT NULL
									   GROUP BY
											  oi.InvoiceItemID
									   UNION ALL         
									   SELECT ri.InvoiceItemID,
											  SUM(oi1.MainQuantity)     MainQuantity,
											  SUM(oi1.SubQuantity)      SubQuantity
									   FROM   sle.RemittanceItem     AS ri
											  JOIN (
													   SELECT oi.RemittanceItemID,
															  SUM(ret.MainQuantity) MainQuantity,
															  SUM(ret.SubQuantity) SubQuantity
													   FROM   stc.OutgoingItem AS oi
															  JOIN (
																	   SELECT roi.OutgoingItemID,
																			  SUM(roi.MainQuantity) MainQuantity,
																			  SUM(roi.SubQuantity) SubQuantity
																	   FROM   stc.ReturnedOutgoingItem AS roi
																	   GROUP BY
																			  roi.OutgoingItemID
																   ) ret
																   ON  oi.OutgoingItemID = ret.OutgoingItemID
													   WHERE  oi.RemittanceItemID IS NOT NULL
													   GROUP BY
															  oi.RemittanceItemID
												   ) oi1
												   ON  ri.RemittanceItemID = oi1.RemittanceItemID
									   WHERE  ri.InvoiceItemID IS NOT NULL
									   GROUP BY
											  ri.InvoiceItemID
							) InDirectInvoiceReturn
				GROUP BY InDirectInvoiceReturn.InvoiceItemID
				) a ON ii.InvoiceItemID=a.InvoiceItemID    
           GROUP BY
                  ii.InvoiceItemID
       )T
       INNER JOIN sle.InvoiceItem  AS ii
            ON  ii.InvoiceItemID = T.InvoiceItemID


		
