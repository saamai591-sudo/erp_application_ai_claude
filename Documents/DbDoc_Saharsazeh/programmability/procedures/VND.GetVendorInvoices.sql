
CREATE   PROCEDURE [VND].[GetVendorInvoices]
(
	@BranchID int,
	@Date date
)
--WITH ENCRYPTION 
AS
BEGIN
    DECLARE @UserID INT,
            @DateType TINYINT,
            @DateFormat VARCHAR(10),
			@Culture NVARCHAR(5),
			@CultureNo tinyint
	    
	SET @Culture = cfg.GetuserCulture()	

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture

    SET @UserID = CFG.GetuserID()
	
    SELECT  @DateType = us.SettingValue
    FROM    CFG.UserSetting us
    WHERE   us.SettingKey = 'Date_Type'
            AND us.UserID = @UserID
	
    IF @DateType IS NULL
        SET @DateType = CASE CFG.GetuserCulture()
                            WHEN 'fa' THEN 0
                            WHEN 'en' THEN 1
                            WHEN 'ar' THEN 2
                        END
	
    SELECT  @DateFormat = us.SettingValue
    FROM    CFG.UserSetting us
    WHERE   us.SettingKey = 'Date_Format'
            AND us.UserID = @UserID
	
    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD'

	select i.PurchaseInvoiceItemID,
	       p.Number,
		   CFG.GetCLRSaturnDate(p.[Date], @DateFormat, 0, @DateType) DateString,
		   p.InvoiceNumber,
		   CFG.GetCLRSaturnDate(p.InvoiceDate, @DateFormat, 0, @DateType) InvoiceDate,
	       i.StuffID,
		   s.Code StuffCode,
		   case @CultureNo
				when 1 then s.Title
				when 2 then s.Title2
		   end as StuffTitle,
		   r.Non MainQuantity,
		   r.NonSub SubQuantity
	from VND.PurchaseInvoiceItem i
	join VND.PurchaseInvoice p on i.PurchaseInvoiceID = p.PurchaseInvoiceID
	join STF.[VWStuff] s on i.StuffID = s.StuffID
	join STF.StuffDetail sd ON s.StuffID = sd.StuffID
	join VND.PurchaseInvoice_Remains r on i.PurchaseInvoiceItemID = r.PurchaseInvoiceItemID
	where s.[Type] = 0 and p.BaseType = 9 and p.BranchID = @BranchID and r.Non > 0 and p.[Date] <= @Date
	     
END
