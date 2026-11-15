
-----------------------------------------------------
CREATE   VIEW [SLE].Remittance_Non_Outgoing
AS 

SELECT ri.RemittanceItemID,
	   ri.StuffID,
	   MainQuantity,
	   SubQuantity,
	   T.DoMainQuantity,
	   T.DoSubQuantity,
	   r.BranchID,
	   r.[Status],
	   r.SaleAreaID,
	   r.SaleTypeID,
	   CASE 
			WHEN s.[Type] = 1 OR MainQuantity < DoMainQuantity THEN 0
			ELSE MainQuantity -DoMainQuantity
	   END                            AS Non,
	   CASE 
			WHEN s.[Type] = 1 OR SubQuantity < DoSubQuantity THEN 0
			ELSE SubQuantity -DoSubQuantity
	   END                            AS SubNon
FROM   (
		   SELECT ri.RemittanceItemID,
				  ISNULL(oi.MainQuantity, 0) + ISNULL(oi2.MainQuantity, 0)
				  +  ISNULL(oi3.MainQuantity, 0) AS 
				  DoMainQuantity,
				  ISNULL(oi.SubQuantity, 0) + ISNULL(oi2.SubQuantity, 0)
				  + ISNULL(oi3.SubQuantity, 0) AS 
				  DoSubQuantity
		   FROM   sle.RemittanceItem AS ri
				  LEFT JOIN (
						   SELECT oi.RemittanceItemID,
								  SUM(oi.MainQuantity) AS MainQuantity,
								  SUM(oi.SubQuantity) AS SubQuantity
						   FROM   stc.OutgoingItem AS oi
						   WHERE oi.RemittanceItemID IS NOT NULL
						   GROUP BY
								  oi.RemittanceItemID
					   ) oi
					   ON  ri.RemittanceItemID = oi.RemittanceItemID
				  LEFT JOIN (
						   SELECT ii.RemittanceItemID,
								  SUM(oi2.MainQuantity) AS MainQuantity,
								  SUM(oi2.SubQuantity) AS SubQuantity
						   FROM   SLE.InvoiceItem AS ii
								  LEFT JOIN STC.OutgoingItem AS oi2
									   ON  oi2.InvoiceItemID = ii.InvoiceItemID
						   WHERE ii.RemittanceItemID IS NOT NULL
						   GROUP BY
								  ii.RemittanceItemID
					   ) oi2
					   ON  ri.RemittanceItemID = oi2.RemittanceItemID
					   
				   LEFT JOIN (
						SELECT ri2.RemittanceItemID,
								  SUM(oi3.MainQuantity) AS MainQuantity,
								  SUM(oi3.SubQuantity) AS SubQuantity
						FROM sle.RemittanceItem AS ri2
						INNER JOIN SLE.InvoiceItem AS ii
								  ON ii.InvoiceItemID = ri2.InvoiceItemID
								INNER JOIN STC.OutgoingItem AS oi3
										  ON oi3.OutgoingItemID = ii.OutgoingItemId
						   WHERE ri2.RemittanceItemID IS NOT NULL
						   GROUP BY
								  ri2.RemittanceItemID
				   
				   ) oi3
						ON  ri.RemittanceItemID = oi3.RemittanceItemID   
	   )T
	   INNER JOIN sle.RemittanceItem  AS ri
			ON  ri.RemittanceItemID = T.RemittanceItemID
		INNER JOIN sle.Remittance r on ri.RemittanceID = r.RemittanceID
	   INNER JOIN STF.[Stuff]         AS s
			ON  s.StuffID = ri.StuffID
