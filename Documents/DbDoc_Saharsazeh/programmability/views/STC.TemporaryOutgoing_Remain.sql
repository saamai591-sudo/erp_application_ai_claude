/************************************************************
 * Code formatted by SoftTree SQL Assistant © v7.2.338
 * Time: 17/08/95 02:00:21 عصر
 ************************************************************/

CREATE VIEW [STC].[TemporaryOutgoing_Remain]

AS 


SELECT T.TemporaryOutgoingItemID,
       MainQuantity,
       T.DoMainQuantity,
       T.DoSubQuantity,
       MainQuantity -DoMainQuantity  AS Non,
       SubQuantity -DoSubQuantity    AS NonSub
FROM   (
           SELECT toi.TemporaryOutgoingItemID,
                  SUM(ISNULL(ji.MainQuantity, 0) + ISNULL(qi.MainQuantity, 0)) AS 
                  DoMainQuantity,
                  SUM(ISNULL(ji.SubQuantity, 0) + ISNULL(qi.SubQuantity, 0)) AS 
                  DoSubQuantity
           FROM   stc.TemporaryOutgoingItem AS toi
                  LEFT JOIN (
                           SELECT TemporaryOutgoingItemID,
                                  SUM(MainQuantity) AS MainQuantity,
                                  SUM(SubQuantity) AS SubQuantity
                           FROM   stc.OutgoingItem AS oi
                           GROUP BY
                                  oi.TemporaryOutgoingItemID
                       )ji
                       ON  ji.TemporaryOutgoingItemID = toi.TemporaryOutgoingItemID
                  LEFT JOIN (
                           SELECT TemporaryOutgoingItemID,
                                  SUM(MainQuantity) AS MainQuantity,
                                  SUM(SubQuantity) AS SubQuantity
                           FROM   stc.ReturnedTemporaryOutgoingItem AS rtoi
                           GROUP BY
                                  rtoi.TemporaryOutgoingItemID
                       ) AS qi
                       ON  qi.TemporaryOutgoingItemID = toi.TemporaryOutgoingItemID
           GROUP BY
                  toi.TemporaryOutgoingItemID
       ) T
       INNER  JOIN stc.TemporaryOutgoingItem AS toi
            ON  toi.TemporaryOutgoingItemID = T.TemporaryOutgoingItemID                   
     



