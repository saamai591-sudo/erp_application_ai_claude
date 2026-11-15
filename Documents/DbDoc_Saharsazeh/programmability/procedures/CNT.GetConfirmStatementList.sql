-------------------------------------
CREATE   PROCEDURE [CNT].[GetConfirmStatementList]
(
    @FinancialPeriodID INT,
	@CompanyRoll TINYINT, 
    @PageNumber INT,
    @RowspPage INT,
    @Sort NVARCHAR(MAX) = NULL,
    @Filter NVARCHAR(MAX) = NULL
)
--WITH ENCRYPTION
AS
BEGIN
    DECLARE @UserID INT,
            @DateType TINYINT,
            @DateFormat VARCHAR(10),
            @ContractorViewRelatedToUser       INT,
	        @ContractorViewRelatedToOthers     INT,           
            @EmployerViewRelatedToUser         INT,
	        @EmployerViewRelatedToOthers       INT,
			@Confirm nvarchar(100),
            @Submit NVARCHAR(100),
            @Voucher NVARCHAR(100),
            @PreVoucher NVARCHAR(100),
            @Culture VARCHAR(10),
			@CultureNo Tinyint,
            @ContractorUnauthorizedUsers NVARCHAR(MAX),
            @EmployerUnauthorizedUsers NVARCHAR(MAX);

    SET @UserID = CFG.GetuserID();
    SET @Culture = CFG.GetuserCulture();
	
	select @CultureNo = CultureNo
	from cfg.CultureInfo
	where Culture = @Culture

    SELECT @Submit = LV.Value
    FROM CFG.LocalizeEnum L
        JOIN CFG.LocalizeEnumValue LV
            ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE L.Enum = 'Statuses'
          AND L.Item = 'Submit'
          AND LV.Culture = @Culture;

    SELECT @Voucher = LV.Value
    FROM CFG.LocalizeEnum L
        JOIN CFG.LocalizeEnumValue LV
            ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE L.Enum = 'PreVoucherStatuses'
          AND L.Item = 'Voucher'
          AND LV.Culture = @Culture;

    SELECT @PreVoucher = LV.Value
    FROM CFG.LocalizeEnum L
        JOIN CFG.LocalizeEnumValue LV
            ON L.LocalizeEnumID = LV.LocalizeEnumID
    WHERE L.Enum = 'PreVoucherStatuses'
          AND L.Item = 'PreVoucher'
          AND LV.Culture = @Culture;

	SELECT @Confirm = LV.Value
	FROM CFG.LocalizeEnum L
		JOIN CFG.LocalizeEnumValue LV
			ON L.LocalizeEnumID = LV.LocalizeEnumID
	WHERE L.Enum = 'ConfirmationStates'
		AND L.Item = 'Confirm'
		AND LV.Culture = @Culture;

    SELECT @DateType = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Type'
          AND us.UserID = @UserID;

    IF @DateType IS NULL
        SET @DateType = CASE CFG.GetuserCulture()
                            WHEN 'fa' THEN
                                0
                            WHEN 'en' THEN
                                1
                            WHEN 'ar' THEN
                                2
                        END;

    SELECT @DateFormat = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Format'
          AND us.UserID = @UserID;

    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD';
        
	SELECT @ContractorViewRelatedToUser = UserID
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'ContractorContractStatement'
		  AND AccessKey = 'ViewRelatedToUser'
		  AND UserID = @UserID;

	SELECT @ContractorViewRelatedToOthers = UserID ,
           @ContractorUnauthorizedUsers = Users
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'ContractorContractStatement'
		  AND AccessKey = 'ViewRelatedToOthers'
		  AND UserID = @UserID;

    SELECT @EmployerViewRelatedToUser = UserID
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'EmployerContractStatement'
		  AND AccessKey = 'ViewRelatedToUser'
		  AND UserID = @UserID;

	SELECT @EmployerViewRelatedToOthers = UserID ,
           @EmployerUnauthorizedUsers = Users
	FROM CFG.vwOperationLevelAccess
	WHERE EntityName = 'EmployerContractStatement'
		  AND AccessKey = 'ViewRelatedToOthers'
		  AND UserID = @UserID;

    IF @Sort IS NULL
       OR @Sort = ''
        SET @Sort = 'Number ';

	select *
	into #Voucher
	from acc.vwVoucherPrevoucher
	where engname = 'ConfirmStatement'
	and FinancialPeriodID = @FinancialPeriodID

	SELECT * 
	INTO #vwBranchAccess 
	FROM cfg.vwBranchAccess 

    DECLARE @Query NVARCHAR(MAX);
    SET @Query = N'
	    ;WITH Query_Result 
			(
				FinancialPeriodID,
				ConfirmStatementID,
				ContractID,
				ContractStatementID,
				Initial,
				Amount,
				Number,
				Date,
				Date_Date,
				PaidAmount,
				Creator,
				CreationDate,
				LastEditor,
				LastEditionDate,
				Version,
				ContractTitle ,
				ContractNumber ,
				StatementNumber,
				CreateDateString ,
				EditionDateString ,
				CreatorUserName ,
				EditorName,
				ContractDlCode,
				IsNotInFlow,
				IsLast,
				ContractStatementTypeString,
				CurrencyRate,
				PreVoucherID,
				VoucherID,
				VoucherNumber,
				VoucherDate,
				Date_VoucherDate,
				Status,
				StatusString,
				PartyCode,
				PartyTitle,
                CurrencyId,
				ConfirmStatus,
				ConfirmStatusString
			)
			As (
				 SELECT cs.FinancialPeriodID ,
						cs.ConfirmStatementID ,
                        cs.ContractID ,
                        cs.ContractStatementID ,
                        cs.Initial ,
                        cs.Amount ,
						cs.Number,
						cs.Date,
						CFG.GetCLRSaturnDate(cs.Date, @DateFormat, 0,@DateType) AS Date_Date ,
                        cs.PaidAmount ,
                        cs.Creator ,
                        cs.CreationDate ,
                        cs.LastEditor ,
                        cs.LastEditionDate ,
                        cs.Version,
                        case when @CultureNo = 1 then c.Title else c.Title2 end ContractTitle ,
                        c.Number ContractNumber ,
                        cst.Number ContarctStatementNumber ,
                        CFG.GetCLRSaturnDate(cs.CreationDate, @DateFormat, 1,@DateType) AS CreateDateString ,
                        CFG.GetCLRSaturnDate(cs.LastEditionDate, @DateFormat,1, @DateType) AS EditionDateString ,
                        u.Name AS CreatorUserName ,
                        u2.Name AS EditorName,
						d.Code ContractDlCode,
					    CAST( CASE WHEN CNT.ConfirmStatementHasFlow(cs.ConfirmStatementID) = 0 THEN 1 ELSE 0 END  AS BIT) AS IsNotInFlow,
					    CNT.IsLastConfirmStatement(cs.ConfirmStatementID) IsLast,
					    case when @CultureNo = 1 then cst1.Title else cst1.Title2 end ContractStatementTypeString,    									        
						cs.CurrencyRate,
						cs.PreVoucherID,
						vp.VoucherID AS VoucherID,
						vp.ReferenceNumber AS VoucherNumber,
						vp.[Date] AS VoucherDate,
						CFG.GetCLRSaturnDate(vp.[Date], @DateFormat, 0, @DateType) AS Date_VoucherDate,
						CASE 
								WHEN vp.VoucherID IS NOT NULL THEN 3
								WHEN cs.PreVoucherID IS NOT NULL THEN 2
								ELSE 1
						   END  AS Status,
						CAST(
						   CASE 
								WHEN vp.VoucherID IS NOT NULL THEN @Voucher
								WHEN cs.PreVoucherID IS NOT NULL THEN @PreVoucher
								ELSE @Submit
						   END AS NVARCHAR(512)
					        )  AS StatusString,
					   dp.Code AS PartyCode,
					   case when @CultureNo = 1 then dp.Title else dp.Title2 end as PartyTitle,
                       cst.CurrencyId,
					   cs.ConfirmStatus,
					   CASE 
							WHEN cs.ConfirmStatus = 1 THEN @Submit
							WHEN cs.ConfirmStatus = 2 THEN @Confirm
							ELSE NULL
						END AS ConfirmStatusString

                FROM    CNT.ConfirmStatement cs
                INNER JOIN CNT.[Contract] c ON c.ContractID = cs.ContractID
				INNER JOIN  #vwBranchAccess Branch on Branch.BranchID = c.BranchID
				INNER JOIN CNT.ContractStatement cst ON cst.ContractStatementID = cs.ContractStatementID
				INNER JOIN CFG.Party AS p ON p.PartyID = cst.PartyID
				INNER JOIN ACC.DL AS dp ON dp.DLID = p.DLID                         
				INNER JOIN cnt.ContractStatementType cst1 on cst.ContractStatementTypeID = cst1.ContractStatementTypeID
                INNER JOIN CFG.[User] u ON u.UserID = cs.Creator
                INNER JOIN CFG.[User] u2 ON u2.UserID = cs.LastEditor
				INNER JOIN ACC.DL d ON d.DLID = c.DLID
				LEFT JOIN #Voucher vp ON  vp.PrevoucherID = cs.PreVoucherID
                WHERE  cs.FinancialPeriodID = @FinancialPeriodID AND c.CompanyRoll = @CompanyRoll
					   AND
                        (                
	                        (c.CompanyRoll = 1 AND (@UserID = -1
		                        OR (@ContractorViewRelatedToUser IS NOT NULL AND cs.Creator = @UserID)
		                        OR (@ContractorViewRelatedToOthers IS NOT NULL AND cs.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@ContractorUnauthorizedUsers) AS rfcst)))
	                        )
	                        OR
	                        (c.CompanyRoll = 2 AND (@UserID = -1
		                        OR (@EmployerViewRelatedToUser IS NOT NULL AND cs.Creator = @UserID)
		                        OR (@EmployerViewRelatedToOthers IS NOT NULL AND cs.Creator NOT IN (SELECT rfcst.value FROM CFG.R_FnCommaStr2Table(@EmployerUnauthorizedUsers) AS rfcst)))
	                        )
                        )
			)
	    ';

    PRINT @Query;
    DECLARE @selectQuery NVARCHAR(MAX);

    IF @Filter IS NULL
       OR @Filter = ''
        SET @Filter = '';
    ELSE
        SET @Filter = 'Where (' + @Filter + ')';

    DECLARE @tableName VARCHAR(100);
    SET @tableName = CFG.getTempTableName(1);



    SET @Query = CFG.ApplyPaging(@tableName, @Query, @PageNumber, @RowspPage, @Filter, @Sort);
    --PRINT @Query

    EXECUTE sp_executesql @Query,
    N'
	@UserID					INT ,
    @DateType				TINYINT ,
    @DateFormat				VARCHAR(10) ,
    @ContractorViewRelatedToUser       INT,
	@ContractorViewRelatedToOthers     INT,
    @EmployerViewRelatedToUser         INT,
	@EmployerViewRelatedToOthers       INT,
    @ContractorUnauthorizedUsers NVARCHAR(MAX) ,
    @EmployerUnauthorizedUsers NVARCHAR(MAX) ,
	@Voucher				NVARCHAR(100),
	@PreVoucher				NVARCHAR(100),
	@Confirm				NVARCHAR(100),
	@Submit					nvarchar(100),
	@FinancialPeriodID		INT,
	@CompanyRoll			TINYINT,
	@CultureNo  tinyint
	',
	@UserID = @UserID,
	@DateType = @DateType,
	@DateFormat = @DateFormat,
    @ContractorViewRelatedToUser = @ContractorViewRelatedToUser ,
    @ContractorViewRelatedToOthers = @ContractorViewRelatedToOthers ,
    @EmployerViewRelatedToUser = @EmployerViewRelatedToUser ,
    @EmployerViewRelatedToOthers = @EmployerViewRelatedToOthers ,
    @ContractorUnauthorizedUsers =  @ContractorUnauthorizedUsers,
    @EmployerUnauthorizedUsers =  @EmployerUnauthorizedUsers,
	@Voucher = @Voucher,
	@PreVoucher = @PreVoucher,
	@Confirm = @Confirm,
	@Submit = @Submit,
	@FinancialPeriodID = @FinancialPeriodID,
	@CompanyRoll = @CompanyRoll,
	@CultureNo = @CultureNo

    DECLARE @Count INT;

    EXEC ('SELECT * FROM ' + @tableName + ' ORDER BY _RN');

    SET @Query = N'select top 1 @Count=  r_count from ' + @tableName;
    EXECUTE sp_executesql @Query, N'@count int out', @Count = @Count OUT;

    RETURN ISNULL(@Count, 0);

END;
