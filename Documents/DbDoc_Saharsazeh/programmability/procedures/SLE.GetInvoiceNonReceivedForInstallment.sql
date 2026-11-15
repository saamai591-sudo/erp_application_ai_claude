
------------------------------------------------
CREATE    PROCEDURE [SLE].GetInvoiceNonReceivedForInstallment
    (
        @date DATE ,
        @branchId INT
    )
--WITH ENCRYPTION
AS
    BEGIN

        DECLARE @UserID INT ,
                @DateType TINYINT ,
                @DateFormat VARCHAR(10) ,
                @Culture VARCHAR(10) ,
                @invoiceConfirmConfig NVARCHAR(20) ,
                @isConfirmNeed BIT = 0,
			@CultureNo VARCHAR(10)

        SET @UserID = CFG.GetuserID();
        SET @Culture = CFG.GetuserCulture();
        select @CultureNo = CultureNo 
	    from cfg.CultureInfo
	    where Culture = @Culture
        SELECT @DateType = us.SettingValue
        FROM   CFG.UserSetting us
        WHERE  us.SettingKey = 'Date_Type'
               AND us.UserID = @UserID;

        IF @DateType IS NULL
            SET @DateType = CASE @Culture
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

        SELECT @invoiceConfirmConfig = LOWER(c.ConfigValue)
        FROM   CFG.Configuration AS c
        WHERE  c.ConfigKey = 'InvoiceNeedConfirm';
        IF @invoiceConfirmConfig = 'true'
            SET @isConfirmNeed = 1;

        SELECT i.InvoiceID AS DocumentID ,
               i.Number ,
               CFG.GetCLRSaturnDate(i.Date, @DateFormat, 0, @DateType) Date ,
               d.Title CutomerTitle ,
               d.Code CustomerDlCode ,
               i.TotalNetPrice Amount ,
               inr.NonReceived AS NonRecivedAmount ,
               p.PartyID,
               i.CurrencyID,
                case when @CultureNo = 1 then Currency.Title else Currency.Title2 end CurrencyTitle
        FROM   SLE.Invoice AS i
         join cfg.Currency on Currency.CurrencyID = i.CurrencyID
               JOIN SLE.Invoice_NonReceived AS inr ON inr.InvoiceID = i.InvoiceID
               JOIN CFG.Party AS p ON p.PartyID = i.CustomerID
               JOIN ACC.DL AS d ON d.DLID = p.DlID
               LEFT JOIN (   SELECT ip.DocumentID
                             FROM   CFG.InstallmentPayment AS ip
                             WHERE  ip.BaseType = 2 ) ss ON ss.DocumentID = i.InvoiceID
        WHERE  (   @isConfirmNeed = 0
                   OR i.SaleInvoiceStatus = 2 )
				   and i.SaleInvoiceStatus <> 5
               AND i.[Date] <= @date
               AND inr.NonReceived > 0
               AND ss.DocumentID IS NULL
               AND i.BranchID = @branchId;
    END;

