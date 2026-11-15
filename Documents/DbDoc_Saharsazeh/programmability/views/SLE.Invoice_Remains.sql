




/************************************************************
 * Code formatted by SoftTree SQL Assistant © v7.2.338
 * Time: 01/08/95 04:18:31 عصر
 ************************************************************/

CREATE VIEW [SLE].[Invoice_Remains]
AS 

SELECT ii.InvoiceItemID,
       MainQuantity,
       T.DoMainQuantity,
       T.DoSubQuantity,
       CASE 
            WHEN s.[Type] = 10  THEN 0
            ELSE MainQuantity -DoMainQuantity
       END                         AS Non,
       CASE 
            WHEN s.[Type] = 10  THEN 0
            ELSE SubQuantity -DoSubQuantity
       END                         AS NonSub
FROM   (
           SELECT ii.InvoiceItemID,
                  SUM(ISNULL(ri.MainQuantity, 0) + ISNULL(oi.MainQuantity, 0)) AS 
                  DoMainQuantity,
                  SUM(ISNULL(ri.SubQuantity, 0) + ISNULL(oi.SubQuantity, 0)) AS 
                  DoSubQuantity
           FROM   sle.InvoiceItem AS ii
                  LEFT JOIN (
                    SELECT 
					 InvoiceItemID,
                                  SUM(MainQuantity) AS MainQuantity,
                                  SUM(SubQuantity) AS SubQuantity
						FROM
                  	STC.OutgoingItem
					GROUP BY InvoiceItemID
                  
                  ) AS oi
                       ON  oi.InvoiceItemID = ii.InvoiceItemID
                  LEFT JOIN (
                  	SELECT 
					 InvoiceItemID,
                                  SUM(MainQuantity) AS MainQuantity,
                                  SUM(SubQuantity) AS SubQuantity
						FROM
                  	SLE.RemittanceItem
                  GROUP BY InvoiceItemID
                  
                  ) AS ri
                       ON  ri.InvoiceItemID = ii.InvoiceItemID
           GROUP BY
                  ii.InvoiceItemID
       )T
       INNER JOIN sle.InvoiceItem  AS ii
            ON  ii.InvoiceItemID = T.InvoiceItemID
       INNER JOIN STF.[Stuff]      AS s
            ON  s.StuffID = ii.StuffID




