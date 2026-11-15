
CREATE VIEW [REQ].[ReturnRequest_Return_Remain]
AS
    SELECT  T.ReturnRequestItemID ,
            toi.AcceptRequestMainMeasureQuantity ,
			toi.AcceptRequestSubMeasureQuantity,
            T.DoMainQuantity ,
            T.DoSubQuantity ,
            toi.AcceptRequestMainMeasureQuantity - DoMainQuantity AS Non ,
            toi.AcceptRequestSubMeasureQuantity - DoSubQuantity AS NonSub
    FROM    ( SELECT    oi.ReturnRequestItemID ,
                        SUM(ISNULL(ji.MainQuantity, 0)) AS DoMainQuantity ,
                        SUM(ISNULL(ji.SubQuantity, 0)) AS DoSubQuantity
              FROM      REQ.ReturnRequestItem AS oi
                        LEFT JOIN ( SELECT  roi.ReturnRequestItemID ,
                                            SUM(MainQuantity) AS MainQuantity ,
                                            SUM(SubQuantity) AS SubQuantity
                                    FROM    STC.ReturnStockReceiptItem AS roi
                                    GROUP BY roi.ReturnRequestItemID
                                  ) ji ON ji.ReturnRequestItemID = oi.ReturnRequestItemID
              GROUP BY  oi.ReturnRequestItemID
            ) T
            INNER  JOIN REQ.ReturnRequestItem AS toi ON toi.ReturnRequestItemID = T.ReturnRequestItemID;



