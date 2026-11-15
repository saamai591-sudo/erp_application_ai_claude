-----------Start of #NoTask

CREATE    VIEW [STC].JustificationInput_Remains
AS 
SELECT T.JustificationInputItemID,
		ji.DeliverDlID,
		ji.[Date],
		ji.StockID,
       MainQuantity,
       T.DoMainQuantity,
       T.DoSubQuantity,
       MainQuantity -DoMainQuantity  AS Non,
       SubQuantity -DoSubQuantity    AS NonSub
FROM   (
           SELECT item.JustificationInputItemID,
                  SUM(ISNULL(used1.MainQuantity, 0)) AS DoMainQuantity,
                  SUM(ISNULL(used1.SubQuantity, 0)) AS DoSubQuantity
           FROM   STC.JustificationInputItem  AS item
                  LEFT JOIN (
                           SELECT JustificationInputItemID,
                                  SUM(MainQuantity) AS MainQuantity,
                                  SUM(SubQuantity) AS SubQuantity
                           FROM   STC.StockReceiptItem  AS pri
                           GROUP BY
                                  JustificationInputItemID
                       )  AS used1
                       ON  item.JustificationInputItemID=used1.JustificationInputItemID
           GROUP BY
                  item.JustificationInputItemID
       ) T
       INNER JOIN STC.JustificationInputItem AS sri
            ON  T.JustificationInputItemID = sri.JustificationInputItemID   
       Inner join stc.JustificationInput AS ji on ji.JustificationInputID = sri.JustificationInputID       
