--------------------------------------------------------------------------------
CREATE   PROCEDURE [CTM].RptReception_ReceptionItem
    @FromDate DATE ,
    @ToDate DATE ,
    @SelectedReception NVARCHAR(MAX) = NULL,
    @SelectedBranch NVARCHAR(MAX) = NULL,
    @SelectedCustomers NVARCHAR(MAX)= NULL,
    @SelectedStuffs NVARCHAR(MAX) = NULL
    --WITH ENCRYPTION
AS
    BEGIN

	DECLARE @UserID INT ,
    @DateType TINYINT ,
    @DateFormat VARCHAR(10) ,
    @Culture VARCHAR(10),
	@CultureNo tinyint

SET @Culture = CFG.GetuserCulture();

SET @UserID = CFG.GetuserID();


	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture

	
SELECT  @DateType = us.SettingValue
FROM    CFG.UserSetting us
WHERE   us.SettingKey = 'Date_Type'
        AND us.UserID = @UserID;
	
IF @DateType IS NULL
    SET @DateType = CASE @Culture
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

        SELECT  ri.ReceptionItemID ,
        r.ReceptionID ,
        r.CustomerID ,
        r.BranchID ,
        r.Number ReceptionNumber ,
		r.[Date] AS ReceptionDate,
        CFG.GetCLRSaturnDate(r.Date,@DateFormat, 0,@DateType) Date_ReceptionDate ,
        ri.StuffID ,
        s.Code StufCode ,
		case when @CultureNo = 1 then s.Title
	         when @CultureNo = 2 then s.Title2
	    end as StufTitle,
        ri.Quantity ,        
		case when @CultureNo = 1 then (ISNULL(p.Title, '') + ' ' + ISNULL(p.LastName, ''))
	         when @CultureNo = 2 then (ISNULL(p.Title2, '') + ' ' + ISNULL(p.LastName2, ''))
	    end as CustomerName,
        p.CustomerCode ,
        FolowUp.FollowUpsPartyName ,
		FolowUp.LastFollwUpDate,
        CFG.GetCLRSaturnDate(FolowUp.LastFollwUpDate,@DateFormat, 0,@DateType) Date_LastFollwUpDate,
		mobile.MobileNumber,
		office.officeNumber,
		a.Address,
		i.Number InvoiceNumber,
		i.[Date] InvoiceDate,
		CFG.GetCLRSaturnDate( i.Date,@DateFormat,0,@DateType) Date_InvoiceDate,
		ri.[Description],
		ri.Description2
FROM    CTM.ReceptionItem ri
        INNER JOIN CTM.Reception r ON r.ReceptionID = ri.ReceptionID
        INNER JOIN STF.VWStuff s ON s.StuffID = ri.StuffID
        INNER JOIN CFG.Party p ON p.PartyID = r.CustomerID
        LEFT JOIN  SLE.InvoiceItem  ii ON ii.InvoiceItemID = ri.InvoiceItemID
        LEFT JOIN SLE.Invoice i ON i.InvoiceID = ii.InvoiceID
		LEFT  JOIN CFG.Address a ON r.AddressID =a.AddressID
        LEFT JOIN ( SELECT  mobile.row_num ,
                            mobile.PartyID ,
                            mobile.Phone MobileNumber
                    FROM    ( SELECT    ROW_NUMBER() OVER ( PARTITION BY p.PartyID ORDER BY p.CreationDate DESC ) row_num ,
                                        p.PartyID ,
                                        p.Phone
                              FROM      CFG.Phone p
                            ) mobile
                    WHERE   mobile.row_num = 1
                  ) mobile ON mobile.PartyID = p.PartyID
        LEFT JOIN ( SELECT  office.row_num ,
                            office.PartyID ,
                            office.Phone officeNumber
                    FROM    ( SELECT    ROW_NUMBER() OVER ( PARTITION BY p.PartyID ORDER BY p.CreationDate DESC ) row_num ,
                                        p.PartyID ,
                                        p.Phone
                              FROM      CFG.Phone p
                            ) office
                    WHERE   office.row_num = 1
                  ) office ON office.PartyID = p.PartyID
        LEFT JOIN ( SELECT case when @CultureNo = 1 then 
									(ISNULL(p.Title, '') + ' ' + ISNULL(p.LastName,''))
	                            when @CultureNo = 2 then 
									(ISNULL(p.Title2, '') + ' ' + ISNULL(p.LastName2,''))
	                       end as FollowUpsPartyName,
                            a.Date LastFollwUpDate ,
                            a.ReceptionID
                     FROM   ( SELECT    ROW_NUMBER() OVER ( PARTITION BY rt.ReceptionID ORDER BY rt.Date DESC ) row_num ,
                                        *
                              FROM      CTM.ReceptionTrace rt
                            ) a
                            INNER JOIN CFG.Party p ON p.PartyID = a.PartyID
                     WHERE  a.row_num = 1
                   ) FolowUp ON FolowUp.ReceptionID = r.ReceptionID
                   INNER JOIN cfg.vwBranchAccess AS vba ON vba.BranchID = r.BranchID
        WHERE   r.Date BETWEEN @fromDate AND @toDate
                AND(
                	@SelectedReception IS NULL 
                	OR
                	r.ReceptionID IN (SELECT VALUE FROM CFG.R_FnCommaStr2Table(@SelectedReception))
                )
                AND(
                	@SelectedBranch IS NULL
                	OR 
                	r.BranchID IN (SELECT VALUE FROM CFG.R_FnCommaStr2Table(@SelectedBranch))
                )
                AND(
                	@SelectedCustomers IS NULL
                	OR 
                	r.CustomerID IN (SELECT VALUE FROM CFG.R_FnCommaStr2Table(@SelectedCustomers))
                )
                AND (
	               @SelectedStuffs IS NULL
	               OR r.ReceptionID IN (SELECT toi.ReceptionID
	                                    FROM   STC.TemporaryOutgoingItem 
	                                           toi
	                                    WHERE  toi.ReceptionID 
	                                           IS NOT 
	                                           NULL
	                                           AND toi.StuffID IN (SELECT VALUE
	                                                               FROM   CFG.R_FnCommaStr2Table(@SelectedStuffs)))
	           )
                
    END



