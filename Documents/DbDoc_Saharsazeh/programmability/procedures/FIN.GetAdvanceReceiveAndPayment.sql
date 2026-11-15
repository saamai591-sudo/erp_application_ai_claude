
-------------------------------------
CREATE    PROCEDURE [FIN].[GetAdvanceReceiveAndPayment] 
(
    @dlid BIGINT = NULL,
    @currencyId INT,
    @date DATE,
    @selectedIds NVARCHAR(MAX),
    @selectedDebits NVARCHAR(MAX),
    @selectedPettyCashs NVARCHAR(MAX),
    @branchId INT = NULL,
    @ContractID INT = NULL,
    @type INT
)
--WITH ENCRYPTION
AS
BEGIN
	
	if @selectedIds = N''
	set @selectedIds = null

	if @selectedDebits = N''
	set @selectedDebits = null

	if @selectedPettyCashs = N''
	set @selectedPettyCashs = null


    DECLARE @userId INT,
            @culture NVARCHAR(10),
            @DateType TINYINT,
            @DateFormat VARCHAR(10),
            @CultureNo TINYINT,
            @Proforma NVARCHAR(100),
            @PurchaseInvoice NVARCHAR(100),
            @Proposal NVARCHAR(100);

    SET @userId = CFG.GetuserID();
    SET @culture = CFG.GetuserCulture();

    SELECT @CultureNo = CultureNo
    FROM CFG.CultureInfo
    WHERE Culture = @culture;

    SELECT @DateType = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Type'
          AND us.UserID = @userId;

    SELECT @DateFormat = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Format'
          AND us.UserID = @UserID;

    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD';

    IF @DateType IS NULL
        SET @DateType = CASE @culture
                            WHEN 'en' THEN
                                1
                            WHEN 'ar' THEN
                                2
                            ELSE
                                0
                        END;

    SELECT @Proforma = lev.Value
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'BaseDocuments'
          AND le.Item = 'ProformaInvoice'
          AND lev.Culture = @culture;

    SELECT @PurchaseInvoice = lev.Value
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'BaseDocuments'
          AND le.Item = 'PurchaseContract'
          AND lev.Culture = @culture;

    SELECT @Proposal = lev.Value
    FROM CFG.LocalizeEnum le
        JOIN CFG.LocalizeEnumValue lev
            ON lev.LocalizeEnumID = le.LocalizeEnumID
    WHERE le.Enum = 'BaseDocuments'
          AND le.Item = 'Proposal'
          AND lev.Culture = @culture;

    IF (@selectedIds IS NULL OR @selectedIds = '')
        SET @selectedIds = NULL;

	SELECT rfcst.value
	into #ids
	FROM CFG.R_FnCommaStr2Table(@selectedIds) AS rfcst

	SELECT rfcst.value
	into #selectedDebits
	FROM CFG.R_FnCommaStr2Table(@selectedDebits) AS rfcst

	SELECT rfcst.value
	into #selectedPettyCashs
	FROM CFG.R_FnCommaStr2Table(@selectedPettyCashs) AS rfcst

    SELECT EntityType,
           EntityId,
           a.Number,
           CFG.GetCLRSaturnDate(a.[Date], @DateFormat, 0, @DateType) DateString,
           b.Code,
           CASE WHEN @CultureNo = 2 THEN b.Title2 ELSE b.Title END AS Title,
           RowIndex,
           Amount,
           NonPrice,
           CurrencyRate,
		   a.CurrencyID,
           CASE WHEN @CultureNo = 2 THEN c.Title2 ELSE c.Title END AS CurrencyTitle,
           CASE DocumentName
               WHEN 'Proforma' THEN @Proforma
               WHEN 'PurchaseInvoice' THEN @PurchaseInvoice
               WHEN 'Proposal' THEN @Proposal
               ELSE NULL
           END DocumentName,
           DocumentNumber,
		   a.ContractID,
		   a.DLID,
		   a.BranchID
		   from [FIN].[VWAdvanceReceiveAndPayment] a
			join acc.dl b on a.DLID = b.DLID
			join cfg.Currency c on c.CurrencyID = a.CurrencyID
			JOIN CFG.Branch bb on bb.BranchID = a.BranchID
	        LEFT JOIN  CNT.Contract cc on cc.ContractID = a.ContractID
	        LEFT JOIN #ids d on d.value = a.EntityId and a.EntityType in (1,5)
	        LEFT JOIN #selectedDebits e on e.value = a.EntityId and a.EntityType in (2,4)
	        LEFT JOIN #selectedPettyCashs f on f.value = a.EntityId and a.EntityType = 3

	     WHERE
		 (
		(@type = 1 and isnull(PaymentType,0) = 10 and IsCredit = 0)
		or
		(@type = 2 and ((isnull(PaymentType,0) = 12 and IsCredit = 0) or (isnull(ReceiptType,0) = 10 and IsCredit = 1 )))
		or
		(@type = 3 and isnull(ReceiptType,0) = 1 and IsCredit = 1)
		)
		AND
          (
		    @dlid is null 
			OR
             a.DLID = @dlid
          )
          AND a.CurrencyID = @currencyId
          AND a.[Date] <= @date
          AND
          (
		      @ContractID IS NULL 
			  OR
              a.ContractID = @ContractID
          )
          AND
          (
		      @branchId IS NULL 
			  OR
              a.BranchID =@branchId
          )
		            AND
          (
              @selectedIds IS NULL
              OR
			  d.value is null
		 )
         AND
		 (
              @selectedDebits IS NULL
              OR
			  e.value is null
		 )
         AND
		 (
              @selectedPettyCashs IS NULL
              OR
			  f.value is null
		 )
END;
