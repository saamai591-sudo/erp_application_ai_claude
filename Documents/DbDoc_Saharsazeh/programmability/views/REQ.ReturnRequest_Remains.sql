

/************************************************************
 * Code formatted by SoftTree SQL Assistant © v7.2.338
 * Time: 06/09/95 12:44:09 ÚÕÑ
 ************************************************************/

CREATE VIEW [REQ].[ReturnRequest_Remains]
AS
    SELECT  T.ReturnRequestItemID ,
            sri.AcceptRequestMainMeasureQuantity ,
			sri.AcceptRequestSubMeasureQuantity,
            T.DoMainQuantity ,
            T.DoSubQuantity ,
            sri.AcceptRequestMainMeasureQuantity - DoMainQuantity AS Non ,
            sri.AcceptRequestSubMeasureQuantity - DoSubQuantity AS NonSub
    FROM    ( SELECT    item.ReturnRequestItemID ,
                        SUM(ISNULL(used1.MainQuantity, 0)) AS DoMainQuantity ,
                        SUM(ISNULL(used1.SubQuantity, 0)) AS DoSubQuantity
              FROM      REQ.ReturnRequestItem AS item
                        LEFT JOIN ( SELECT  ReturnRequestItemID ,
                                            SUM(MainQuantity) AS MainQuantity ,
                                            SUM(SubQuantity) AS SubQuantity
                                    FROM    STC.ReturnedTemporaryStockReceiptItem
                                            AS pri
                                    GROUP BY ReturnRequestItemID
                                  ) AS used1 ON item.ReturnRequestItemID = used1.ReturnRequestItemID
              GROUP BY  item.ReturnRequestItemID
            ) T
            INNER JOIN REQ.ReturnRequestItem AS sri ON T.ReturnRequestItemID = sri.ReturnRequestItemID;     
      

