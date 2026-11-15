

CREATE   PROC [POS].[GetPosInvoicesForInstallmentAccumulation]
    (
      @FinancialPeriodId INT ,
      @Date DATE ,
      @ids NVARCHAR(MAX) = NULL
    )
AS
    BEGIN
        DECLARE @UserID INT ,
            @DateType TINYINT ,
            @DateFormat VARCHAR(10),
			@Culture NVARCHAR(5),
			@CultureNo tinyint
	    
	SET @Culture = cfg.GetuserCulture()	

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture;

        IF ( @ids = '' )
            SET @ids = NULL;
 
        SET @UserID = CFG.GetuserID();
	
        SELECT  @DateType = us.SettingValue
        FROM    CFG.UserSetting us
        WHERE   us.SettingKey = 'Date_Type'
                AND us.UserID = @UserID;

        SELECT  @DateFormat = us.SettingValue
        FROM    CFG.UserSetting us
        WHERE   us.SettingKey = 'Date_Format'
                AND us.UserID = @UserID;
	
        IF @DateType IS NULL
            SET @DateType = CASE CFG.GetuserCulture()
                              WHEN 'fa' THEN 0
                              WHEN 'en' THEN 1
                              WHEN 'ar' THEN 2
                            END;

        IF @DateFormat IS NULL
            SET @DateFormat = 'YY/MM/DD';


        SELECT  p.PosInvoiceID ,
                p.Number InvoiceNumber ,
                CFG.GetCLRSaturnDate(p.Date, @DateFormat, 0, @DateType) AS InvoiceDate ,
                d.Code AS PartyCode ,                
				case @CultureNo
					when 1 then pa.Title + ' ' + pa.LastName
					when 2 then pa.Title2 + ' ' + pa.LastName2
				end as PartyName,
                p.TotalNetPrice Price ,
                p.TotalNetPrice
                - ISNULL(( SELECT   SUM(TotalAmount)
                           FROM     POS.PosReceipt
                           WHERE    PosInvoiceID = p.PosInvoiceID
                         ), 0) InstallmentAmount
        FROM    POS.PosInvoice p
                LEFT JOIN POS.DeliveryPosInvoice dp ON dp.PosInvoiceID = p.PosInvoiceID
                LEFT JOIN POS.InstallmentAccumulationItem iai ON iai.PosInvoiceId = p.PosInvoiceID
                JOIN CFG.Party pa ON pa.PartyID = p.CustomerID
                JOIN ACC.DL d ON d.DLID = pa.DlID
        WHERE   p.HasInstallment = 1
                AND p.IsReturnInvoice = 0
                AND p.[Status] <> 0
                AND dp.[Status] = 2
                AND dp.DeliveryID IS NOT NULL
                AND iai.PosInvoiceId IS NULL
                AND p.Date <= @Date
                AND ( @ids IS NULL
                      OR p.PosInvoiceID NOT IN (
                      SELECT    value
                      FROM      CFG.R_FnCommaStr2Table(@ids) )
                    );
    END;
 
