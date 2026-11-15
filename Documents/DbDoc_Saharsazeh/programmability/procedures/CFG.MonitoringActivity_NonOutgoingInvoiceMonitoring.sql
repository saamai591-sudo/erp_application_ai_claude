
---------------------------------------
CREATE      PROCEDURE [CFG].MonitoringActivity_NonOutgoingInvoiceMonitoring
(
    @financialPeriodId INT
)
--WITH ENCRYPTION
AS
    BEGIN
        SET NOCOUNT ON;

        DECLARE @UserID INT ,
                @DateType TINYINT ,
                @DateFormat VARCHAR(10) ,
                @JustIsConfirmed BIT = 0 ,
                @User INT;

        SET @User = CFG.GetuserID();

        SELECT @JustIsConfirmed = CAST(c.ConfigValue AS BIT)
        FROM   CFG.Configuration c
        WHERE  c.ConfigKey = 'InvoiceNeedConfirm';

        SET @UserID = CFG.GetuserID();

        SELECT @DateType = us.SettingValue
        FROM   CFG.UserSetting us
        WHERE  us.SettingKey = 'Date_Type'
               AND us.UserID = @UserID;

        IF @DateType IS NULL
            SET @DateType = CASE CFG.GetuserCulture()
                                 WHEN 'fa' THEN 0
                                 WHEN 'en' THEN 1
                                 WHEN 'ar' THEN 2
                            END;

        SELECT @DateFormat = us.SettingValue
        FROM   CFG.UserSetting us
        WHERE  us.SettingKey = 'Date_Format'
               AND us.UserID = @UserID;

        IF @DateFormat IS NULL
            SET @DateFormat = 'YY/MM/DD';
            
             SELECT * INTO #vwBranchAccess
            FROM cfg.vwBranchAccess AS vba;
            
              SELECT * INTO #vwSaleAreaAccess
            FROM cfg.vwSaleAreaAccess AS vsaa;
            
           SELECT * INTO #vwPartyAccess
           FROM cfg.vwPartyAccess AS vpa
            
            SELECT v.StuffID,v.code,v.Title,v.Title2,v.[Type] into #vwStuff
             FROM stf.VWStuff AS v

        SELECT ii.InvoiceItemID ,
               i.InvoiceID ,
               i.Number ,
               i.[Date] ,
               CFG.GetCLRSaturnDate(i.[Date], @DateFormat, 0, @DateType) DateString ,
               i.CustomerID ,
               ISNULL(p.Title, '') + ' ' + ISNULL(p.LastName, '') CustomerName ,
			   ISNULL(p.Title2, '') + ' ' + ISNULL(p.LastName2, '') CustomerName2 ,
               p.CustomerCode ,
               ii.StuffID ,
               s.Code StuffCode ,
               s.Title StuffTitle ,
			   s.Title2 StuffTitle2,
               ii.MainQuantity ,
               inog.Non AS Non_Outgoing ,
               b.Code BranchCode ,
               b.Title BranchTitle,
			   b.Title2 BranchTitle2
        FROM   SLE.Invoice i
               INNER JOIN SLE.InvoiceItem ii ON ii.InvoiceID = i.InvoiceID
               INNER JOIN CFG.Party p ON p.PartyID = i.CustomerID
               INNER JOIN #vwStuff s ON s.StuffID = ii.StuffID
               INNER JOIN SLE.Invoice_Non_OutGoing AS inog ON inog.InvoiceItemID = ii.InvoiceItemID
               JOIN CFG.Branch b ON b.BranchID = i.BranchID
               INNER JOIN #vwBranchAccess AS vba ON vba.BranchID = i.BranchID 
               INNER JOIN #vwSaleAreaAccess AS vsaa ON vsaa.SaleAreaID = i.SaleAreaID
               INNER JOIN #vwPartyAccess AS vpa ON vpa.PartyID=i.CustomerID
        WHERE  inog.Non > 0
               AND i.BaseDocument <> 13
               AND i.FinancialPeriodID = @financialPeriodId
               AND i.[SaleInvoiceStatus] <> 5
               AND (   @JustIsConfirmed = 0
                       OR i.[SaleInvoiceStatus] = 2 )
               AND s.[Type] = 0;
    END;
