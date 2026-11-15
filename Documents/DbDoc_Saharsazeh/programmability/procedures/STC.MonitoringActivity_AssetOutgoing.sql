------------------------------------------------------------------------------------------------------------------
CREATE   PROCEDURE [STC].MonitoringActivity_AssetOutgoing
(@FinancialPeriodId INT)
--WITH ENCRYPTION
AS
BEGIN
	DECLARE @userId         INT,
	        @DateType       TINYINT,
	        @DateFormat     VARCHAR(10)
	
	SET @userId = CFG.GetuserID()
	
	SELECT @DateType = us.SettingValue
	FROM   CFG.UserSetting us
	WHERE  us.SettingKey = 'Date_Type'
	       AND us.UserID = @userId
	
	IF @DateType IS NULL
	    SET @DateType = CASE CFG.GetuserCulture()
	                         WHEN 'fa' THEN 0
	                         WHEN 'en' THEN 1
	                         WHEN 'ar' THEN 2
	                    END
	
	SELECT @DateFormat = us.SettingValue
	FROM   CFG.UserSetting us
	WHERE  us.SettingKey = 'Date_Format'
	       AND us.UserID = @userId
	
	IF @DateFormat IS NULL
	    SET @DateFormat = 'YY/MM/DD'
	
	SELECT oi.OutgoingItemID,
	       o.Number,
	       CFG.GetCLRSaturnDate(o.[Date], @DateFormat, 0, @DateType) OutgoingDate,
	       s.Code                           StockCode,
	       s.Title                          StockTitle,
	       d.Code                           CostCenterCode,
	       d.Title                          CostCenterTitle,
	       st.Code                          StuffCode,
	       st.Title                         StuffTitle,
	       oi.MainQuantity
	FROM   STC.OutgoingItem oi
	       JOIN STC.Outgoing o
	            ON  oi.OutgoingID = o.OutgoingID
	       JOIN STF.Stock s
	            ON  o.StockID = s.StockID
			JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
				ON o.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
	       JOIN STF.[Stuff] st
	            ON  oi.StuffID = st.StuffID
	       JOIN STC.StockDocumentType sdt
	            ON  sdtb.StockDocumentTypeID = sdt.StockDocumentTypeID
	       LEFT JOIN ACC.DL d
	            ON  o.DeliverDlID = d.DLID
	       INNER JOIN cfg.vwStockAccess  AS vsa
	            ON  vsa.StockID = o.StockID
	WHERE  o.FinancialPeriodID = @FinancialPeriodId
	       AND sdt.DocumentType = 8
	       AND oi.OutgoingItemID NOT IN (SELECT c.OutgoingItemID
	                                     FROM   AST.Creation c
	                                     WHERE  c.OutgoingItemID IS NOT NULL)
	       AND oi.OutgoingItemID NOT IN (SELECT r.OutgoingItemID
	                                     FROM   AST.RepairStuffCost r
	                                     WHERE  r.OutgoingItemID IS NOT NULL)
END

