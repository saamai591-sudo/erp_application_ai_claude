
---------------Start of #7731
CREATE    VIEW [REQ].StuffRequest_Remains
AS
SELECT sri.StuffRequestItemID,
	   sri.StuffID,
	   sr.BranchID,
	   sr.StuffRequestState,
       sri.AcceptRequestMainMeasureQuantity,
       sri.AcceptRequestSubMeasureQuantity,
       sr.StuffRequestDate,
       sr.StuffRequestNumber,
       sr.StuffRequestID,
       CASE 
            WHEN ISNULL(T.DoMainQuantity, 0) > ISNULL(TOutGoing.doOutGoing, 0) THEN ISNULL(T.DoMainQuantity, 0)
            ELSE ISNULL(TOutGoing.doOutGoing, 0)
       END                                 DoMainQuantity,
       CASE 
            WHEN ISNULL(T.DoSubQuantity, 0) > ISNULL(TOutGoing.doSubOutGoing, 0) THEN ISNULL(T.DoSubQuantity, 0)
            ELSE ISNULL(TOutGoing.doSubOutGoing, 0)
       END                                 DoSubQuantity,
       ISNULL(TOutGoing.doOutGoing, 0)  AS DoOutGoing,
       ISNULL(TOutGoing.doSubOutGoing, 0) AS DoSubOutGoing,
       sri.AcceptRequestMainMeasureQuantity - CASE 
                                                   WHEN ISNULL(T.DoMainQuantity, 0) > ISNULL(TOutGoing.doOutGoing, 0) THEN 
                                                        ISNULL(T.DoMainQuantity, 0)
                                                   ELSE ISNULL(TOutGoing.doOutGoing, 0)
                                              END AS Non,
       sri.AcceptRequestSubMeasureQuantity - CASE 
                                                  WHEN ISNULL(T.DoSubQuantity, 0) > ISNULL(TOutGoing.doSubOutGoing, 0) THEN 
                                                       ISNULL(T.DoSubQuantity, 0)
                                                  ELSE ISNULL(TOutGoing.doSubOutGoing, 0)
                                             END AS NonSub,
       sri.AcceptRequestMainMeasureQuantity - ISNULL(TOutGoing.doOutGoing, 0) AS NonOutgoing,
       sri.AcceptRequestSubMeasureQuantity - ISNULL(TOutGoing.doSubOutGoing, 0) AS NonSubOutgoing
FROM   REQ.StuffRequestItem             AS sri
join req.StuffRequest sr on sri.StuffRequestID = sr.StuffRequestID
       LEFT JOIN (
                SELECT StuffRequestItemID,
                       SUM(ISNULL(MainQuantity, 0)) AS DoMainQuantity,
                       SUM(SubQuantity)  AS DoSubQuantity
                FROM   (
                           SELECT StuffRequestItemID,
                                  AcceptRequestMainMeasureQuantity AS MainQuantity,
                                  pri.AcceptRequestSubMeasureQuantity AS SubQuantity
                           FROM   REQ.PurchaseRequestItem AS pri
                           WHERE  StuffRequestItemID IS NOT NULL
                           UNION ALL
                           SELECT StuffRequestItemID,
                                  MainQuantity,
                                  SubQuantity
                           FROM   VND.PurchaseContractItem
                           WHERE  StuffRequestItemID IS NOT NULL
                           UNION ALL
                           SELECT BaseStuffRequestItemID,
                                  MainQuantity,
                                  SubQuantity
                           FROM   Req.StuffRequestItem AS sri
                           WHERE  sri.BaseStuffRequestItemID IS NOT NULL
                       )                    u
                GROUP BY
                       StuffRequestItemID
            ) T
            ON  T.StuffRequestItemID = sri.StuffRequestItemID
       LEFT JOIN (
                SELECT oi.StuffRequestItemID,
                       SUM(oi.MainQuantity) AS doOutGoing,
                       SUM(oi.SubQuantity) AS doSubOutGoing
                FROM   STC.OutgoingItem AS oi
                WHERE  oi.StuffRequestItemID IS NOT NULL
                GROUP BY
                       oi.StuffRequestItemID
            ) TOutGoing
            ON  TOutGoing.StuffRequestItemID = sri.StuffRequestItemID
