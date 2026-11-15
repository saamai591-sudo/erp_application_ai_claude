------------------------------------------------------------------------------------------------------------------
Create   PROCEDURE [CFG].MonitoringActivity_OutgoingWithoutInvoice
    (
      @financialPeriodId INT
    )

--WITH ENCRYPTION
AS
    BEGIN
        SET NOCOUNT ON;
	
        DECLARE @UserID INT ,
            @DateType TINYINT ,
            @ViewRelatedToUser INT ,
            @ViewRelatedToOthers INT ,
            @DateFormat VARCHAR(10);
	
        SET @UserID = CFG.GetuserID();
	
        SELECT  @DateType = us.SettingValue
        FROM    CFG.UserSetting us
        WHERE   us.SettingKey = 'Date_Type'
                AND us.UserID = @UserID;
	
        IF @DateType IS NULL
            SET @DateType = CASE CFG.GetuserCulture()
                              WHEN 'fa' THEN 0
                              WHEN 'en' THEN 1
                              WHEN 'ar' THEN 2
                            END;
	
	
        SELECT  @DateFormat = us.SettingValue
        FROM    CFG.UserSetting us
        WHERE   us.SettingKey = 'Date_Format'
                AND us.UserID = @UserID;
	
        IF @DateFormat IS NULL
            SET @DateFormat = 'YY/MM/DD';  

			SELECT * into #vwStockAccess
			from cfg.vwStockAccess

			select * into #Outgoing_Non_Invoice
			from SLE.Outgoing_Non_Invoice

	
        SELECT  oi.OutgoingItemID ,
                o.OutgoingID ,
                o.Number ,
                CFG.GetCLRSaturnDate(o.[Date], @DateFormat, 0, @DateType) DateString ,
                o.DeliverDlID DlID ,
                d.Code CustomerCode ,
                d.Title CustomerName ,
				d.Title2 CustomerName2 ,
                oi.StuffID ,
                s.Code StuffCode ,
                s.Title StuffTitle ,
				s.Title2 StuffTitle2,
                oi.MainQuantity ,
                oni.Non AS Non_Invoice ,
                st.Code StockCode ,
                st.Title StockTitle,
				st.Title2 StockTitle2,
				sdt.Title AS StockDocumentTypeTitle,
				sdt.Title2 AS StockDocumentTypeTitle2
        FROM    STC.Outgoing o
        JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
            ON o.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
                JOIN STC.StockDocumentType sdt ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
                INNER JOIN STC.OutgoingItem oi ON oi.OutgoingID = o.OutgoingID
                INNER JOIN ACC.DL d ON d.DLID = o.DeliverDlID
                INNER JOIN STF.[Stuff] s ON s.StuffID = oi.StuffID
                JOIN STF.Stock st ON st.StockID = o.StockID
                INNER JOIN #Outgoing_Non_Invoice AS oni ON oni.OutgoingItemID = oi.OutgoingItemID
                INNER JOIN #vwStockAccess AS vsa ON vsa.StockID = st.StockID
        WHERE   oni.Non > 0
                AND o.FinancialPeriodID = @financialPeriodId
                AND (sdt.[DocumentType] = 1 OR sdt.DocumentType = 10 ) 
                AND o.DeliverDlID IS NOT NULL
    END;



