
CREATE   VIEW [REQ].[PurchaseRequest_Non_Proposal]
AS
    SELECT  T.PurchaseRequestItemID ,
            T.MainQuantity ,
            T.SubQuantity ,
            T.DoMainQuantity ,
            T.DoSubQuantity ,
            T.MainQuantity - T.DoMainQuantity AS Non ,
            T.SubQuantity - T.DoSubQuantity AS SubNon
    FROM    ( SELECT    mi.PurchaseRequestItemID ,
                        SUM(mi.AcceptRequestMainMeasureQuantity) MainQuantity ,
                        SUM(mi.AcceptRequestSubMeasureQuantity) SubQuantity ,
                        isnull(SUM(mo.MainQuantity),0) DoMainQuantity ,
                        isnull(SUM(mo.SubQuantity),0) DoSubQuantity
              FROM      REQ.PurchaseRequestItem AS mi
                        LEFT JOIN REQ.PurchaseRequest_Proposal vw ON vw.PurchaseRequestItemID = mi.PurchaseRequestItemID
                        LEFT JOIN VND.ProposalItem AS mo ON mo.ProposalItemID = vw.ProposalItemID
              GROUP BY  mi.PurchaseRequestItemID
            ) T;
