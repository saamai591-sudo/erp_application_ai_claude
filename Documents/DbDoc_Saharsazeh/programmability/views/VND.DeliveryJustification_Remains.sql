-------------------------------------
CREATE   VIEW [VND].[DeliveryJustification_Remains]
AS 

SELECT T.DeliveryJustificationItemID,
       MainQuantity,
       T.DoMainQuantity,
       T.DoSubQuantity,
       MainQuantity -DoMainQuantity  AS Non,
       SubQuantity -DoSubQuantity    AS NonSub
FROM   (
           SELECT item.DeliveryJustificationItemID,
                  SUM(ISNULL(used1.MainQuantity, 0)) +
                  SUM(ISNULL(used2.MainQuantity, 0)) +
                  SUM(ISNULL(used3.MainQuantity, 0)) AS DoMainQuantity,
                  SUM(ISNULL(used1.SubQuantity, 0)) +
                  SUM(ISNULL(used2.SubQuantity, 0)) +
                  SUM(ISNULL(used3.SubQuantity, 0)) AS DoSubQuantity
           FROM   VND.DeliveryJustificationItem  AS item

                  LEFT JOIN (
                           SELECT pri.DeliveryJustificationItemID,
                                  SUM(MainQuantity) AS MainQuantity,
                                  SUM(SubQuantity) AS SubQuantity
                           FROM   STC.StockReceiptItem AS pri
                           GROUP BY
                                  pri.DeliveryJustificationItemID
                       )            AS used1
                       ON  item.DeliveryJustificationItemID = used1.DeliveryJustificationItemID

                  LEFT JOIN (
                           SELECT pri.DeliveryJustificationItemID,
                                  SUM(MainQuantity) AS MainQuantity,
                                  SUM(SubQuantity) AS SubQuantity
                           FROM   STC.TemporaryStockReceiptItem AS pri
                           GROUP BY
                                  DeliveryJustificationItemID
                       )            AS used2
                       ON  item.DeliveryJustificationItemID = used2.DeliveryJustificationItemID

                  LEFT JOIN (
                           SELECT ari.DeliveryJustificationItemID,
                                  SUM(ari.MainQuantity) AS MainQuantity,
                                  CAST(0 AS DECIMAL(30, 4)) AS SubQuantity
                           FROM   AST.AssetReceiptItem AS ari
                           WHERE  ari.DeliveryJustificationItemID IS NOT NULL
                           GROUP BY
                                  ari.DeliveryJustificationItemID
                       )            AS used3
                       ON  item.DeliveryJustificationItemID = used3.DeliveryJustificationItemID
					
           GROUP BY
                  item.DeliveryJustificationItemID
       ) T
       INNER JOIN VND.DeliveryJustificationItem   AS sri
            ON  T.DeliveryJustificationItemID = sri.DeliveryJustificationItemID     
      

