
CREATE   proc STC.spStuffWithChargingService
(@CompanyID INT)
as 

SELECT o.DeliverDlID,
       oi.StuffID,
       oi.MainQuantity                Delivered,
       -ro.EquivalentMainQuantity      Received,
	   -returned.ReturnedQuantity		ReturnedQuantity,
       oi.MainQuantity - ISNULL(ro.EquivalentMainQuantity, 0) - isnull(returned.ReturnedQuantity,0) Non
INTO   #Source
FROM   stc.Outgoing                AS o
       JOIN stf.Stock s
            ON  o.StockID = s.StockID
       JOIN cfg.Branch b
            ON  s.BranchID = b.BranchID
       JOIN stc.OutgoingItem       AS oi
            ON  oi.OutgoingID = o.OutgoingID
       JOIN stc.StockDocumentTypeBaseEntity AS sdtbe
            ON  sdtbe.StockDocumentTypeBaseEntityID = o.StockDocumentTypeBaseEntityID
       JOIN stc.StockDocumentType  AS sdt
            ON  sdt.StockDocumentTypeID = sdtbe.StockDocumentTypeID
       left JOIN (
                SELECT SUM(srcs.MainQuantity) EquivalentMainQuantity,
                       srcs.OutgoingItemID
                FROM   stc.StockReceiptChargingService AS srcs
                GROUP BY
                       srcs.OutgoingItemID
            ) ro
            ON  ro.OutgoingItemID = oi.OutgoingItemID
       left JOIN (
                SELECT oi.OutgoingItemID,
                       SUM(roi.MainQuantity) ReturnedQuantity
                FROM   stc.ReturnedOutgoingItem roi
                       JOIN stc.ReturnedOutgoing ro
                            ON  roi.ReturnedOutgoingID = ro.ReturnedOutgoingID
                       JOIN stc.OutgoingItem oi
                            ON  roi.OutgoingItemID = oi.OutgoingItemID
                       JOIN stc.Outgoing o
                            ON  oi.OutgoingID = o.OutgoingID
                       JOIN stc.StockDocumentTypeBaseEntity sdtbe
                            ON  o.StockDocumentTypeBaseEntityID = sdtbe.StockDocumentTypeBaseEntityID
                       JOIN stc.StockDocumentType sdt
                            ON  sdtbe.StockDocumentTypeID = sdt.StockDocumentTypeID
                WHERE  sdt.DocumentType = 14
                       AND sdt.Type = 2
					   group by oi.OutgoingItemID
            ) returned on oi.OutgoingItemID = returned.OutgoingItemID
WHERE  sdt.DocumentType = 14
       AND sdt.Type = 2
       AND b.CompanyID = @CompanyID

SELECT *
INTO   #vwStuff
FROM   stf.VWStuff


SELECT d.DLID,
       d.Code       DlCode,
       d.Title      DlTitle,
       d.Title2     DlTitle2,
       s.StuffID,
       s.Code       StuffCode,
       s.Title      StuffTitle,
       s.Title2     StuffTitle2,
       src.Delivered,
	   src.ReturnedQuantity,
       src.Received,
       src.Non
FROM   #Source src
       JOIN #vwStuff s
            ON  src.StuffID = s.StuffID
       JOIN acc.DL d
            ON  src.DeliverDlID = d.DLID
