
CREATE   VIEW [VND].[PurchaseContract_Remains]
AS 

SELECT T.PurchaseContractItemID,
       MainQuantity,
       T.DoMainQuantity,
       T.DoSubQuantity,
       MainQuantity -DoMainQuantity  AS Non,
       SubQuantity -DoSubQuantity    AS NonSub
FROM   (
           SELECT item.PurchaseContractItemID,
                  SUM(ISNULL(used1.MainQuantity, 0)) +
                  SUM(ISNULL(used2.MainQuantity, 0)) +
                  SUM(ISNULL(used3.MainQuantity, 0)) +
                  SUM(ISNULL(used4.MainQuantity, 0)) +
				  SUM(ISNULL(used5.MainQuantity, 0)) +
                  SUM(ISNULL(used6.MainQuantity, 0)) AS DoMainQuantity,
                  SUM(ISNULL(used1.SubQuantity, 0)) +
                  SUM(ISNULL(used2.SubQuantity, 0)) +
                  SUM(ISNULL(used3.SubQuantity, 0)) +
                  SUM(ISNULL(used4.SubQuantity, 0)) +
                  SUM(ISNULL(used6.SubQuantity, 0)) +
				  SUM(ISNULL(used5.SubQuantity, 0)) AS DoSubQuantity
           FROM   VND.PurchaseContractItem  AS item

                  LEFT JOIN (
                           SELECT pri.PurchaseContractItemID,
                                  SUM(MainQuantity) AS MainQuantity,
                                  SUM(SubQuantity) AS SubQuantity
                           FROM   STC.StockReceiptItem AS pri
                           GROUP BY
                                  pri.PurchaseContractItemID
                       )            AS used1
                       ON  item.PurchaseContractItemID = used1.PurchaseContractItemID

                  LEFT JOIN (
                           SELECT pri.PurchaseContractItemID,
                                  SUM(MainQuantity) AS MainQuantity,
                                  SUM(SubQuantity) AS SubQuantity
                           FROM   VND.PurchaseInvoiceItem AS pri
                           GROUP BY
                                  PurchaseContractItemID
                       )            AS used2
                       ON  item.PurchaseContractItemID = used2.PurchaseContractItemID

                  LEFT JOIN (
                           SELECT PurchaseContractItemID,
                                  SUM(MainQuantity) AS MainQuantity,
                                  SUM(SubQuantity) AS SubQuantity
                           FROM   STC.TemporaryStockReceiptItem AS pri
                           GROUP BY
                                  PurchaseContractItemID
                       )            AS used3
                       ON  item.PurchaseContractItemID = used3.PurchaseContractItemID

                  LEFT JOIN (
                           SELECT PurchaseContractItemID,
                                  SUM(MainQuantity) AS MainQuantity,
                                  SUM(SubQuantity) AS SubQuantity
                           FROM   STC.JustificationInputItem AS pri
                           GROUP BY
                                  PurchaseContractItemID
                       )            AS used4
                       ON  item.PurchaseContractItemID = used4.PurchaseContractItemID

					LEFT JOIN (
								select PurchaseContractItemID,
								       sum(MainQuantity) as MainQuantity,
									   sum(isnull(SubQuantity,0)) as SubQuantity
								from FOS.ProformaInvoiceItem 
								where PurchaseContractItemID is not null
								group by PurchaseContractItemID
					          ) used5 on item.PurchaseContractItemID = used5.PurchaseContractItemID

                    LEFT JOIN (
                        SELECT
                            PurchaseContractItemID,
                            SUM(MainQuantity) AS MainQuantity,
                            SUM(ISNULL(SubQuantity, 0)) AS SubQuantity
                        FROM VND.DeliveryJustificationItem
                        WHERE PurchaseContractItemID IS NOT NULL
                        GROUP BY PurchaseContractItemID
                    ) AS used6
                        ON item.PurchaseContractItemID = used6.PurchaseContractItemID         
                        
           GROUP BY
                  item.PurchaseContractItemID
       ) T
       INNER JOIN VND.PurchaseContractItem   AS sri
            ON  T.PurchaseContractItemID = sri.PurchaseContractItemID     
      
