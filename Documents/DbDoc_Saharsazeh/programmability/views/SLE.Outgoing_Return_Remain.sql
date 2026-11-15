-------------------------------------
CREATE  
VIEW [SLE].Outgoing_Return_Remain
AS
SELECT T.OutgoingItemID,
       T.MainQuantity,
       T.SubQuantity,
       T.DoMainQuantity,
       T.DoSubQuantity,
       T.MainQuantity - T.DoMainQuantity AS Non,
       T.SubQuantity - T.DoSubQuantity AS NonSub
FROM
(
    SELECT oi.OutgoingItemID,
           oi.MainQuantity,
           oi.SubQuantity,
           ISNULL(ji.MainQuantity, 0) + ISNULL(rsc.MainQuantity, 0)+isnull(uc.MainQuantity,0)+ISNULL(ari.MainQuantity,0) AS DoMainQuantity,
           ISNULL(ji.SubQuantity, 0) + ISNULL(rsc.SubQuantity, 0)+isnull(uc.SubQuantity,0)+ISNULL(ari.SubQuantity,0) AS DoSubQuantity
    FROM STC.OutgoingItem AS oi
        LEFT JOIN
        (
            SELECT roi.OutgoingItemID,
                   SUM(MainQuantity) AS MainQuantity,
                   SUM(SubQuantity) AS SubQuantity
            FROM STC.ReturnedOutgoingItem AS roi
            WHERE OutgoingItemID IS NOT NULL
            GROUP BY roi.OutgoingItemID
        ) ji
            ON ji.OutgoingItemID = oi.OutgoingItemID
        LEFT JOIN
        (
            SELECT c.OutgoingItemID,
                   c.MainQuantity,
                   c.SubQuantity
            FROM AST.RepairStuffCost c
                JOIN STC.OutgoingItem oi
                    ON c.OutgoingItemID = oi.OutgoingItemID
        ) rsc
            ON rsc.OutgoingItemID = oi.OutgoingItemID
 LEFT JOIN
        (
            SELECT c.OutgoingItemID,
                   c.MainQuantity,
                   c.SubQuantity
            FROM
                (SELECT c1.OutgoingItemID,
                        c1.MainQuantity,
                        c1.SubQuantity
                FROM AST.UtilizationCost c1 
            
                UNION

                SELECT c2.OutgoingItemID,
                       c2.MainQuantity,
                       c2.SubQuantity
                FROM AST.AssetReceiptUtilizationCost c2
                ) c
            JOIN STC.OutgoingItem oi ON c.OutgoingItemID = oi.OutgoingItemID

        ) uc
            ON uc.OutgoingItemID = oi.OutgoingItemID
        LEFT JOIN
        (
            SELECT ari.OutgoingItemID,
                   SUM(ari.MainQuantity) AS MainQuantity,
                   CAST(0 AS DECIMAL(30, 4)) AS SubQuantity
            FROM AST.AssetReceiptItem ari
            WHERE ari.OutgoingItemID IS NOT NULL
            GROUP BY ari.OutgoingItemID
        ) ari
            ON ari.OutgoingItemID = oi.OutgoingItemID

) T;
