
------------------------------------- START #65363
CREATE   PROCEDURE [CNT].spConfirmStatementPreVoucherInsert
	@ConfirmStatementID NVARCHAR(MAX)
	 --WITH ENCRYPTION
AS
	-----------------------------Declare Parameters--------------------------------	
	DECLARE @DocumentNumTypeId               INT = (
	            SELECT DNT.DocumentNumTypeID
	            FROM   CFG.DocumentNumType DNT
	            WHERE  DNT.EngName = 'ConfirmStatement'
	        ),
	        @MDEntity                        INT = (
	            SELECT Top 1             Id
	            FROM   mdt.DmdEntity  AS de
	            WHERE  Name = 'ConfirmStatement'
	        ),
	        @MaxPrevoucherID                 INT,
	        @BaseDigit                       DECIMAL(18, 4),
	        @Culture                         VARCHAR(10),
	        @CultureNo                       INT,
	        @CreatorId                       INT,
	        @HeaderDescription               NVARCHAR(MAX),
	        @HeaderDescription2              NVARCHAR(MAX),
	        @ContractSubjectDescription      NVARCHAR(MAX),
	        @ContractSubjectDescription2     NVARCHAR(MAX),
	        @AdditionDescription             NVARCHAR(MAX),
	        @AdditionDescription2            NVARCHAR(MAX),
	        @DeductionDescription            NVARCHAR(MAX),
	        @DeductionDescription2           NVARCHAR(MAX),
	        @PayableAccountsVsStatementAndAdditionDescription NVARCHAR(MAX),
	        @PayableAccountsVsStatementAndAdditionDescription2 NVARCHAR(MAX),
	        @TaxDescription                  NVARCHAR(MAX),
	        @TaxDescription2                 NVARCHAR(MAX),
	        @DutyDescription                 NVARCHAR(MAX),
	        @DutyDescription2                NVARCHAR(MAX),
	        @PayableAccountsVsVatDescription NVARCHAR(MAX),
	        @PayableAccountsVsVatDescription2 NVARCHAR(MAX),
	        @PayableAccountsVsDeductionDescription NVARCHAR(MAX),
	        @PayableAccountsVsDeductionDescription2 NVARCHAR(MAX),
	        @PayableAccountsVsPrepaymentDescription NVARCHAR(MAX),
	        @PayableAccountsVsPrepaymentDescription2 NVARCHAR(MAX),
	        @PrepaymentDescription           NVARCHAR(MAX),
	        @PrepaymentDescription2          NVARCHAR(MAX),
	        @AllocationSharingDescription NVARCHAR(MAX),
	        @AllocationSharingDescription2 NVARCHAR(MAX),
	        @PurchasePrevoucherIsNet         TINYINT,
	        @ExchangeManner                  TINYINT,	--1=GainOrLoss  2=Cost
	        @DateFormat                      VARCHAR(10),
	        @DateType                        TINYINT
	
	SELECT @DateFormat = us.SettingValue
	FROM   CFG.UserSetting us
	WHERE  us.SettingKey = 'Date_Format'
	       AND us.UserID = CFG.GetuserID();
	
	IF @DateFormat IS NULL
	    SET @DateFormat = 'YY/MM/DD';
	
	SELECT @DateType = us.SettingValue
	FROM   CFG.UserSetting us
	WHERE  us.SettingKey = 'Date_Type'
	       AND us.UserID = CFG.GetuserID();
	
	IF @DateType IS NULL
	    SET @DateType = CASE CFG.GetuserCulture()
	                         WHEN 'fa' THEN 0
	                         WHEN 'en' THEN 1
	                         WHEN 'ar' THEN 2
	                         ELSE 0
	                    END;
	
	SELECT @ExchangeManner = c.ConfigValue
	FROM   cfg.Configuration AS c
	WHERE  c.ConfigKey = 'ExchangeManner'
	
	SET @ExchangeManner = ISNULL(@ExchangeManner, 1)
	
	SET @CreatorId = cfg.GetuserID();
	SET @Culture = cfg.GetuserCulture();
	
	SELECT @CultureNo = CultureNo
	FROM   cfg.CultureInfo
	WHERE  Culture = @Culture
	
	SELECT [value] ID
	INTO   #DocumentIds
	FROM   cfg.R_FnCommaStr2Table(@ConfirmStatementID) 
	
	SET @BaseDigit = cfg.GetBaseCurrencyPrecision();
	
	
	SELECT @HeaderDescription = DESCRIPTION,
	       @HeaderDescription2     = Description2
	FROM   CFG.[VoucherDescription]
	WHERE  MDEntityID              = @MDEntity
	       AND [Key]               = 'Header'
	
	SELECT @ContractSubjectDescription = DESCRIPTION,
	       @ContractSubjectDescription2     = Description2
	FROM   CFG.[VoucherDescription]
	WHERE  MDEntityID                       = @MDEntity
	       AND [Key]                        = 'ContractSubject'
	
	SELECT @AdditionDescription = DESCRIPTION,
	       @AdditionDescription2     = Description2
	FROM   CFG.[VoucherDescription]
	WHERE  MDEntityID                = @MDEntity
	       AND [Key]                 = 'Additions'
	
	SELECT @DeductionDescription = DESCRIPTION,
	       @DeductionDescription2     = Description2
	FROM   CFG.[VoucherDescription]
	WHERE  MDEntityID                 = @MDEntity
	       AND [Key]                  = 'Deductions'
	
	SELECT @PayableAccountsVsStatementAndAdditionDescription = DESCRIPTION,
	       @PayableAccountsVsStatementAndAdditionDescription2 = Description2
	FROM   CFG.[VoucherDescription]
	WHERE  MDEntityID     = @MDEntity
	       AND [Key]      = 'PayableAccountsVsStatementAndAddition'
	
	SELECT @TaxDescription = DESCRIPTION,
	       @TaxDescription2     = Description2
	FROM   CFG.[VoucherDescription]
	WHERE  MDEntityID           = @MDEntity
	       AND [Key]            = 'Tax'
	
	SELECT @DutyDescription = DESCRIPTION,
	       @DutyDescription2     = Description2
	FROM   CFG.[VoucherDescription]
	WHERE  MDEntityID            = @MDEntity
	       AND [Key]             = 'Duty'
	
	SELECT @PayableAccountsVsVatDescription = DESCRIPTION,
	       @PayableAccountsVsVatDescription2 = Description2
	FROM   CFG.[VoucherDescription]
	WHERE  MDEntityID     = @MDEntity
	       AND [Key]      = 'PayableAccountsVsVat'
	
	SELECT @PayableAccountsVsDeductionDescription = DESCRIPTION,
	       @PayableAccountsVsDeductionDescription2 = Description2
	FROM   CFG.[VoucherDescription]
	WHERE  MDEntityID     = @MDEntity
	       AND [Key]      = 'PayableAccountsVsDeduction'
	
	SELECT @PayableAccountsVsPrepaymentDescription = DESCRIPTION,
	       @PayableAccountsVsPrepaymentDescription2 = Description2
	FROM   CFG.[VoucherDescription]
	WHERE  MDEntityID     = @MDEntity
	       AND [Key]      = 'PayableAccountsVsPrepayment'
	
	SELECT @PrepaymentDescription = DESCRIPTION,
	       @PrepaymentDescription2     = Description2
	FROM   CFG.[VoucherDescription]
	WHERE  MDEntityID                  = @MDEntity
	       AND [Key]                   = 'Prepayment'
	
	SELECT @AllocationSharingDescription = DESCRIPTION,
	       @AllocationSharingDescription2 = Description2
	FROM   CFG.[VoucherDescription]
	WHERE  MDEntityID     = @MDEntity
	       AND [Key]      = 'AllocationSharing'
	
	SELECT @MaxPrevoucherID = MAX(PreVoucherID)
	FROM   acc.PreVoucher
	
	SELECT @PurchasePrevoucherIsNet = CASE c.ConfigValue
	                                       WHEN 'true' THEN 1
	                                       ELSE 0
	                                  END
	FROM   cfg.Configuration AS c
	WHERE  c.ConfigKey = 'PurchasePrevoucherIsNet'
	
	IF @PurchasePrevoucherIsNet IS NULL
	BEGIN
	    SET @PurchasePrevoucherIsNet = 0
	END                            
	
	SELECT ISNULL(@MaxPrevoucherID, 0) + ROW_NUMBER() over(order by cs.ConfirmStatementID) PrevoucherID,
	       cs.ConfirmStatementID,
	       Currency.CurrencyID,
	       cs.CurrencyRate,
	       dl.DlID                           PartyDLID,
	       cs.ContractStatementID,
	       c.BranchID,
	       dl.Title                          PartyTitle,
	       dl.Title2                         PartyTitle2,
	       Currency.ExchangeUnit,
	       IsBaseCurrencyBasis,
	       cs.ContractID,
	       c.DLID                            ContractDLID,
	       c.CompanyRoll,
	       cs.Date,
	       f.FinancialPeriodID,
	       t.SlID                            PayableAccountSlId,
	       Tax,
	       Duty,
	       cs1.Number                        ContractStatementNumber,
	       CFG.GetCLRSaturnDate(cs1.FromDate, @DateFormat, 0, @DateType) FromDate,
	       CFG.GetCLRSaturnDate(cs1.EndDate, @DateFormat, 0, @DateType) ToDate,
	       t.Title                           ContractStatementType,
	       t.Title2                          ContractStatementType2,
	       Currency.Title                    CurrencyTitle,
	       Currency.Title2                   CurrencyTitle2,
	       c.Number                          ContractNumber,
	       c.Title                           ContractTitle,
	       c.Title2                          ContractTitle2,
	       t.ContractStatementTypeid,
	       t.TaxSLID,
	       t.DutySLID,
	       CASE 
	            WHEN @CultureNo = 1 THEN t.Title
	            ELSE t.Title2
	       END                               ContractStatementTypeTitle,
	       CAST(null as VARCHAR(MAX))        ErrorMessage,
	       cs.Initial,
	       @HeaderDescription                HeaderDescription,
	       @HeaderDescription2               HeaderDescription2,
	       cs.Number,
	       dd.FullDateAlternateKey,
	       dd.PersianFullDateAlternateKey,
	       @PayableAccountsVsStatementAndAdditionDescription PayableAccountsVsStatementAndAdditionDescription,
	       @PayableAccountsVsStatementAndAdditionDescription2 PayableAccountsVsStatementAndAdditionDescription2,
	       @TaxDescription                   TaxDescription,
	       @TaxDescription2                  TaxDescription2,
	       @DutyDescription                  DutyDescription,
	       @DutyDescription2                 DutyDescription2,
	       @PayableAccountsVsVatDescription PayableAccountsVsVatDescription,
	       @PayableAccountsVsVatDescription2 PayableAccountsVsVatDescription2,
	       @PayableAccountsVsDeductionDescription PayableAccountsVsDeductionDescription,
	       @PayableAccountsVsDeductionDescription2 PayableAccountsVsDeductionDescription2,
	       @PayableAccountsVsPrepaymentDescription PayableAccountsVsPrepaymentDescription,
	       @PayableAccountsVsPrepaymentDescription2 PayableAccountsVsPrepaymentDescription2,
	       @AllocationSharingDescription     AllocationSharingDescription,
	       @AllocationSharingDescription2 AllocationSharingDescription2,
	       c.ProjectId,
	       dd2.FullDateAlternateKey                        ContractStatementDate
	INTO   #ConfirmStatement
	FROM   cnt.ConfirmStatement cs
	       left JOIN cnt.Contract c
	            ON  c.ContractID = cs.ContractID
	       left JOIN cnt.ContractStatement cs1
	            ON  cs1.ContractStatementID = cs.ContractStatementID
	       JOIN cnt.ContractStatementType t
	            ON  t.ContractStatementTypeID = cs1.ContractStatementTypeID
	       left JOIN (
	                SELECT ContractStatementID,
	                       SUM(Tax)      Tax,
	                       SUM(Duty)     Duty
	                FROM   cnt.ContractStatementItem
	                GROUP BY
	                       ContractStatementID
	            ) i
	            ON  i.ContractStatementID = cs1.ContractStatementID
	       JOIN cfg.party p
	            ON  p.PartyID = cs1.PartyID
	       JOIN acc.dl
	            ON  dl.DLID = p.DlID
	       JOIN cfg.Currency
	            ON  Currency.CurrencyID = cs1.CurrencyID
	       JOIN #DocumentIds ids
	            ON  ids.ID = CS.ConfirmStatementID
	       JOIN cfg.DimDate DD
	            ON  DD.Date = CS.Date
	       JOIN cfg.FinancialPeriod f
	            ON  cs.Date between f.StartDate and f.EndDate
	       join cfg.DimDate AS dd2 on cs1.[Date] = dd2.[Date]     
	
	UPDATE #ConfirmStatement
	SET    ErrorMessage = 'InitialStatementHasNoVoucher' + CHAR(10) + CHAR(13)
	WHERE  Initial = 1
	
	UPDATE #ConfirmStatement
	SET    ErrorMessage = ErrorMessage + N'PayableAccountSlNotSpecifiedInContractStatementType^' + 
	       ContractStatementTypeTitle + CHAR(10) + CHAR(13)
	WHERE  PayableAccountSlId is null
	
	UPDATE #ConfirmStatement
	SET    ErrorMessage = ErrorMessage + N'PreTaxSlNotSpecifiedInContractStatementType^' + ContractStatementTypeTitle + 
	       CHAR(10) + CHAR(13)
	WHERE  TaxSlID is null
	
	UPDATE #ConfirmStatement
	SET    ErrorMessage = ErrorMessage + N'PreDutySlNotSpecifiedInContractStatementType^' + ContractStatementTypeTitle 
	       + CHAR(10) + CHAR(13)
	WHERE  DutySLID is null
	
	IF EXISTS (
	       SELECT 1
	       FROM   #ConfirmStatement
	       WHERE  ErrorMessage is NOT null
	   )
	BEGIN
	    SELECT ConfirmStatementID,
	           ErrorMessage
	    FROM   #ConfirmStatement
	    
	    RETURN;
	END
	
	SELECT *
	INTO   #PreviuosContractSubject
	FROM   (
	           SELECT ROW_NUMBER() over(PARTITION by csi.ContractSubjectID order by cs.Number desc) Rno,
	                  csi.ContractSubjectID,
	                  csi.Amount
	           FROM   cnt.ContractStatement cs
			   join cnt.ContractStatementType cst on cst.ContractStatementTypeID = cs.ContractStatementTypeID
	                  JOIN cnt.ContractStatementItem csi
	                       ON  csi.ContractStatementID = cs.ContractStatementID
	                  JOIN #ConfirmStatement h
	                       ON  h.ContractID = cs.ContractID
	                       AND h.ContractStatementNumber > cs.Number
	                       AND h.CurrencyID = cs.CurrencyID
				where cst.Type in (1,4)
	       )a
	WHERE  Rno = 1
	
	----Get TItem
	
	
	SELECT i.ContractSubjectID,
	       ContractStatementItemID,
	       CASE 
	            WHEN c.CompanyRoll = 2 and cst.Type = 2 THEN cst.AdjustmentSLID
	            WHEN c.CompanyRoll = 2 and cst.Type = 3 THEN cst.SuspensionSLID
	            ELSE s.Slid
	       END     Slid,
	       CASE 
	            WHEN cst.Type IN (1, 4) and c.StatementDeliverySection = 1 THEN i.Amount - ISNULL(pre.Amount, 0)
	            ELSE i.Amount
	       END     Amount,
	       CASE 
	            WHEN IsBaseCurrencyBasis = 0 THEN ROUND(
	                     CASE 
	                          WHEN cst.Type IN (1, 4)
	                               AND c.StatementDeliverySection = 1 THEN i.Amount - ISNULL(pre.Amount, 0)
	                              ELSE i.Amount
	                         END 
	                         * currencyrate / ExchangeUnit,
	                     @BaseDigit
	                 )
	            WHEN IsBaseCurrencyBasis = 1 THEN ROUND(
	                     CASE 
	                          WHEN cst.Type IN (1, 4)
	                               AND c.StatementDeliverySection = 1 THEN i.Amount - ISNULL(pre.Amount, 0)
	                              ELSE i.Amount
	                         END 
	                         * ExchangeUnit / currencyrate,
	                     @BaseDigit
	                 )
	       END     AmountInBaseCurrency,
	       h.PrevoucherID,
	       h.CompanyRoll,
	       h.ConfirmStatementID,
	       h.CurrencyID,
	       h.CurrencyRate,
	       REPLACE(
	           @ContractSubjectDescription,
	           '@@StatementDescription@@',
	           ISNULL(i.Description, '')
	       )       DESCRIPTION,
	       REPLACE(
	           @ContractSubjectDescription2,
	           '@@StatementDescription@@',
	           ISNULL(i.Description2, '')
	       )       Description2,
		   s.DlID LocationDlID
	INTO   #TItem
	FROM   cnt.ContractStatement cs
	       JOIN cnt.ContractStatementType cst
	            ON  cs.ContractStatementTypeID = cst.ContractStatementTypeID
	       JOIN cnt.Contract c
	            ON  c.ContractID = cs.ContractID
	       JOIN cnt.ContractStatementItem i
	            ON  i.ContractStatementID = cs.ContractStatementID
	       JOIN cnt.ContractSubject s
	            ON  s.ContractSubjectID = i.ContractSubjectID
	       left JOIN #PreviuosContractSubject pre
	            ON  pre.ContractSubjectID = i.ContractSubjectID
	       JOIN #ConfirmStatement h
	            ON  cs.ContractStatementID = h.ContractStatementID


	SELECT SUM(Amount)                   Amount,
	       SUM(AmountInBaseCurrency)     AmountInBaseCurrency,
	       ConfirmStatementID
	INTO   #TItemSum
	FROM   #Titem
	GROUP BY
	       ConfirmStatementID
	
	---Get Additions
	
	
	SELECT cs.ConfirmStatementItemID,
	       m.SlID,
	       cs.Addition,
	       CASE 
	            WHEN h.IsBaseCurrencyBasis = 0 THEN ROUND(Addition * currencyrate / ExchangeUnit, @BaseDigit)
	            WHEN IsBaseCurrencyBasis = 1 THEN ROUND(Addition * ExchangeUnit / currencyrate, @BaseDigit)
	       END     AdditionInBaseCurrency,
	       h.PrevoucherID,
	       h.CompanyRoll,
	       h.ConfirmStatementID,
	       H.CurrencyID,
	       H.CurrencyRate,
	       REPLACE(
	           @AdditionDescription,
	           '@@RowDescription@@',
	           ISNULL(cs.Description, '')
	       )       DESCRIPTION,
	       REPLACE(
	           @AdditionDescription2,
	           '@@RowDescription@@',
	           ISNULL(cs.Description2, '')
	       )       Description2
	INTO   #Additions
	FROM   cnt.ConfirmStatementItem cs
	       JOIN cnt.AdditionDeductionType adt
	            ON  adt.AdditionDeductionTypeID = cs.AdditionDeductionTypeID
	       JOIN cnt.AdditionDeductionTypeMethod m
	            ON  m.AdditionDeductionTypeMethodID = cs.AdditionDeductionTypeMethodID
	       JOIN #ConfirmStatement h
	            ON  h.ConfirmStatementID = cs.ConfirmStatementID
	WHERE  adt.Type = 1 
	
	--get AdditionSum
	SELECT ConfirmStatementID,
	       SUM(AdditionInBaseCurrency)     AdditionInBaseCurrency,
	       SUM(Addition)                   Addition
	INTO   #AdditionsSum
	FROM   #Additions
	GROUP BY
	       ConfirmStatementID
	
	
	---Get Deduction
	SELECT cs.ConfirmStatementItemID,
	       m.SlID,
	       cs.Deduction,
	       CASE 
	            WHEN h.IsBaseCurrencyBasis = 0 THEN ROUND(cs.Deduction * h.CurrencyRate / h.ExchangeUnit, @BaseDigit)
	            WHEN IsBaseCurrencyBasis = 1 THEN ROUND(cs.Deduction * h.ExchangeUnit / h.CurrencyRate, @BaseDigit)
	       END     DeductionInBaseCurrency,
	       CASE 
	            WHEN csd.ContractStatementDetailID is NOT null THEN p.DlID
	            ELSE H.PartyDLID
	       END     DlID,
	       h.PrevoucherID,
	       h.CompanyRoll,
	       h.ConfirmStatementID,
	       h.CurrencyID,
	       h.CurrencyRate,
	       REPLACE(
	           @DeductionDescription,
	           '@@RowDescription@@',
	           ISNULL(cs.Description, '')
	       )       DESCRIPTION,
	       REPLACE(
	           @DeductionDescription2,
	           '@@RowDescription@@',
	           ISNULL(cs.Description2, '')
	       )       Description2
	INTO   #Deduction
	FROM   cnt.ConfirmStatementItem cs
	       JOIN cnt.AdditionDeductionType adt
	            ON  adt.AdditionDeductionTypeID = cs.AdditionDeductionTypeID
	       JOIN cnt.AdditionDeductionTypeMethod m
	            ON  m.AdditionDeductionTypeMethodID = cs.AdditionDeductionTypeMethodID
	       left JOIN cnt.ContractStatementDetail csd
	            ON  cs.BaseDocumentID = csd.ContractStatementDetailID
	            AND cs.BaseDocumentType = 3
	       left JOIN cfg.Party p
	            ON  p.PartyID = csd.PartyID
	       JOIN #ConfirmStatement h
	            ON  h.ConfirmStatementID = cs.ConfirmStatementID
	WHERE  adt.Type = 2
	       AND adt.Criterion = 1
	
	
	SELECT ConfirmStatementID,
	       SUM(DeductionInBaseCurrency)     DeductionInBaseCurrency,
	       SUM(Deduction)                   Deduction
	INTO   #DeductionSum
	FROM   #deduction
	GROUP BY
	       ConfirmStatementID
	
	
	
	---Get Prepayment
	SELECT a.ConfirmStatementPrePaymentID,
	       m.SlID,
	       a.Price,
	       CASE 
	            WHEN h.IsBaseCurrencyBasis = 0 THEN ROUND(
	                     a.Price *
	                     CASE 
	                          WHEN a.PaymentSubjectID is NOT null THEN ps.CurrencyRate
	                          WHEN a.DebitCreditNoteItemID is NOT null THEN dcni.CurrencyRate
	                          WHEN a.ReceiveSubjectID is NOT null THEN rs.CurrencyRate
	                     END
	                     / h.ExchangeUnit,
	                     @BaseDigit
	                 )
	            WHEN h.IsBaseCurrencyBasis = 1 THEN ROUND(
	                     a.Price * h.ExchangeUnit /
	                     CASE 
	                          WHEN a.PaymentSubjectID is NOT null THEN ps.CurrencyRate
	                          WHEN a.DebitCreditNoteItemID is NOT null THEN dcni.CurrencyRate
	                          WHEN a.ReceiveSubjectID is NOT null THEN rs.CurrencyRate
	                     END,
	                     @BaseDigit
	                 )
	       END                         PriceInBaseCurrency,
	       CASE 
	            WHEN a.PaymentSubjectID is NOT null THEN ps.CurrencyRate
	            WHEN a.DebitCreditNoteItemID is NOT null THEN dcni.CurrencyRate
	            WHEN a.ReceiveSubjectID is NOT null THEN rs.CurrencyRate
	       END                         CurrencyRate,
	       m.ExchangeGainLossSlID,
	       @PrepaymentDescription      DESCRIPTION,
	       @PrepaymentDescription2     Description2,
	       h.PrevoucherID,
	       h.CompanyRoll,
	       h.ConfirmStatementID,
	       h.CurrencyID
	INTO   #ConfirmStatementPrePayment
	FROM   cnt.ConfirmStatementPrePayment a
	       JOIN cnt.ConfirmStatementItem b
	            ON  a.ConfirmStatementItemID = b.ConfirmStatementItemID
	       JOIN cnt.AdditionDeductionTypeMethod m
	            ON  m.AdditionDeductionTypeMethodID = b.AdditionDeductionTypeMethodID
	       left JOIN fin.PaymentSubject ps
	            ON  ps.PaymentSubjectID = a.PaymentSubjectID
	       left JOIN cfg.DebitCreditNoteItem dcni
	            ON  dcni.DebitCreditNoteItemID = a.DebitCreditNoteItemID
	       left JOIN fin.ReceiveSubject rs
	            ON  a.ReceiveSubjectID = rs.ReceiveSubjectID
	       JOIN #ConfirmStatement h
	            ON  h.ConfirmStatementID = b.ConfirmStatementID
	
	
	SELECT a.ConfirmStatementID,
	       a.Price,
	       a.PriceInBaseCurrency,
	       b.AllocationSharingAmount,
	       a.PriceInBaseCurrency - b.AllocationSharingAmount PriceInBaseCurrencyWithConfirmStatementRate
	INTO   #ConfirmStatementPrePaymentSum
	FROM   (
	           SELECT ConfirmStatementID,
	                  SUM(PriceInBaseCurrency) PriceInBaseCurrency,
	                  SUM(price) Price
	           FROM   #ConfirmStatementPrePayment
	           GROUP BY
	                  ConfirmStatementID
	       )a
	       JOIN (
	                SELECT ConfirmStatementID,
	                       SUM(AllocationSharingAmount) AllocationSharingAmount
	                FROM   cnt.ConfirmStatementItem
	                GROUP BY
	                       ConfirmStatementID
	            ) b
	            ON  a.ConfirmStatementID = b.ConfirmStatementID
	
	--select * from #ConfirmStatementPrePaymentSum
	
	
	---Get Other Costs
	SELECT pt.SlID,
	       cs.Amount,
	       CASE 
	            WHEN h.IsBaseCurrencyBasis = 0 THEN ROUND(cs.Amount * h.CurrencyRate / h.ExchangeUnit, @BaseDigit)
	            WHEN h.IsBaseCurrencyBasis = 1 THEN ROUND(cs.Amount * h.ExchangeUnit / h.CurrencyRate, @BaseDigit)
	       END AmountInBaseCurrency,
	       cs.Description,
	       cs.Description2,
	       p.DlID,
	       h.PrevoucherID,
	       h.PayableAccountSlId,
	       h.CurrencyID,
	       h.CurrencyRate,
	       cs.ContractStatementDetailID
	INTO   #OtherCosts
	FROM   cnt.ContractStatementDetail cs
	       JOIN cfg.Party p
	            ON  p.PartyID = cs.PartyID
	       JOIN fin.PaymentType pt
	            ON  cs.BaseDocumentType = 1
	            AND pt.PaymentTypeID = cs.BaseDocumentID
	       JOIN #ConfirmStatement h
	            ON  h.ContractStatementID = h.ContractStatementID
	
	
	---GetAccountsPayable 
	SELECT cs.ConfirmStatementID,
	       tits.AmountInBaseCurrency,
	       ISNULL(ad.AdditionInBaseCurrency, 0) AdditionInBaseCurrency,
	       ISNULL(ad.Addition, 0)        Addition,
	       ds.Deduction,
	       ds.DeductionInBaseCurrency,
	       ISNULL(cs.Tax, 0)             Tax,
	       ISNULL(cs.Duty, 0)            Duty,
	       tits.AmountInBaseCurrency 
	       + ISNULL(ad.AdditionInBaseCurrency, 0) 
	       - ISNULL(cspp.PriceInBaseCurrencyWithConfirmStatementRate, 0)
	       - ISNULL(ds.DeductionInBaseCurrency, 0) NetAmountInBaseCurrency,
	       tits.Amount 
	       + ISNULL(ad.Addition, 0) 
	       - ISNULL(cspp.Price, 0) 
	       - ISNULL(ds.Deduction, 0)     NetAmount,
	       tits.Amount
	INTO   #PayableAccount
	FROM   #ConfirmStatement cs
	       INNER JOIN #TItemSum tits
	            ON  tits.ConfirmStatementID = cs.ConfirmStatementID
	       LEFT JOIN #AdditionsSum ad
	            ON  tits.ConfirmStatementID = ad.ConfirmStatementID
	       LEFT JOIN #DeductionSum ds
	            ON  tits.ConfirmStatementID = ds.ConfirmStatementID
	       LEFT JOIN #ConfirmStatementPrePaymentSum cspp
	            ON  tits.ConfirmStatementID = cspp.ConfirmStatementID
	
	-----------------------------------insert in prevoucher------------------
	SET identity_insert [ACC].[PreVoucher] on
	INSERT INTO [ACC].[PreVoucher](
	           PreVoucherId,
	           [BranchID],
	           [DocumentNumtypeID],
	           [Date],
	           [FinancialPeriodID],
	           [Description],
	           [Description2],
	           [Creator],
	           [CreationDate],
	           [LastEditor],
	           [LastEditionDate],
	           [Version]
	       )
	SELECT PreVoucherId,
	       BranchId,
	       @DocumentNumTypeId,
	       DATE,
	       FinancialPeriodID,
	       HeaderDescription,
	       HeaderDescription2,
	       @CreatorId,
	       GETDATE(),
	       @CreatorId,
	       GETDATE(),
	       0
	FROM   #ConfirmStatement
	
	SET identity_insert [ACC].[PreVoucher] off
	
	UPDATE a
	SET    PreVoucherID = b.PreVoucherId
	FROM   cnt.ConfirmStatement a
	       JOIN #ConfirmStatement b
	            ON  a.ConfirmStatementID = b.ConfirmStatementID
	
	
	---CompanyRoll = 1
	IF EXISTS (
	       SELECT 1
	       FROM   #ConfirmStatement
	       WHERE  CompanyRoll = 1
	   )
	BEGIN
	    -----------------------------------insert ContractSubjectSl------------------
	    INSERT INTO acc.PreVoucherItem
	           (
	               PreVoucherID,
	               RowIndex,
	               SlID,
	               [Description],
	               Description2,
	               Debit,
	               Credit,
	               CurrencyID,
	               CurrencyRate,
	               CurrencyDebit,
	               CurrencyCredit,
	               IsAutoGenerated,
	               Creator,
	               CreationDate,
	               LastEditor,
	               LastEditionDate,
	               Version,
	               BaseDocumentName,
	               BaseDocumentID
	           )
	    SELECT PreVoucherID,
	           1,
	           SlID,
	           DESCRIPTION,
	           Description2,
	           ABS(CASE WHEN Amount > 0 THEN AmountInBaseCurrency ELSE 0 END),
	           ABS(CASE WHEN Amount > 0 THEN 0 ELSE AmountInBaseCurrency END),
	           CurrencyId,
	           currencyrate,
	           ABS(CASE WHEN Amount > 0 THEN Amount ELSE 0 END),
	           ABS(CASE WHEN Amount > 0 THEN 0 ELSE Amount END),
	           1,
	           @CreatorId,
	           GETDATE(),
	           @CreatorId,
	           GETDATE(),
	           1,
	           'ContractStatementItem',
	           ContractStatementItemID
	    FROM   #TItem
	    WHERE  Amount <> 0
	           AND CompanyRoll = 1
	    -----------------------------------insert Additions------------------
	    INSERT INTO ACC.PreVoucherItem
	           (
	               PreVoucherID,
	               RowIndex,
	               SlID,
	               DESCRIPTION,
	               Description2,
	               Debit,
	               Credit,
	               CurrencyID,
	               CurrencyRate,
	               CurrencyDebit,
	               CurrencyCredit,
	               Creator,
	               CreationDate,
	               LastEditor,
	               LastEditionDate,
	               Version,
	               BaseDocumentName,
	               BaseDocumentID
	           )
	    SELECT PreVoucherId,
	           1,
	           SlID,
	           DESCRIPTION,
	           Description2,
	           AdditionInBaseCurrency,
	           0,
	           CurrencyId,
	           currencyrate,
	           Addition,
	           0,
	           @CreatorId,
	           GETDATE(),
	           @CreatorId,
	           GETDATE(),
	           0,
	           'ConfirmStatementItem',
	           ConfirmStatementItemID
	    FROM   #Additions
	    WHERE  CompanyRoll = 1
	    -----------------------------------AccountsPayable insert------------------
	    IF @PurchasePrevoucherIsNet = 0
	    BEGIN
	        INSERT INTO acc.PreVoucherItem
	               (
	                   PreVoucherID,
	                   RowIndex,
	                   SlID,
	                   [Description],
	                   Description2,
	                   Debit,
	                   Credit,
	                   CurrencyID,
	                   CurrencyRate,
	                   CurrencyDebit,
	                   CurrencyCredit,
	                   IsAutoGenerated,
	                   Creator,
	                   CreationDate,
	                   LastEditor,
	                   LastEditionDate,
	                   Version,
	                   BaseDocumentName,
	                   BaseDocumentID
	               )
	        SELECT a.PrevoucherID,
	               1,
	               a.PayableAccountSlId,
	               a.PayableAccountsVsStatementAndAdditionDescription,
	               a.PayableAccountsVsStatementAndAdditionDescription2,
	               CASE 
	                    WHEN pa.AmountInBaseCurrency + ISNULL(pa.AdditionInBaseCurrency, 0) > 0 THEN 0
	                    ELSE ABS(
	                             pa.AmountInBaseCurrency + ISNULL(pa.AdditionInBaseCurrency, 0)
	                         )
	               END     Debit,
	               CASE 
	                    WHEN pa.AmountInBaseCurrency + ISNULL(pa.AdditionInBaseCurrency, 0) > 0 THEN ABS(
	                             pa.AmountInBaseCurrency + ISNULL(pa.AdditionInBaseCurrency, 0)
	                         )
	                    ELSE 0
	               END     Credit,
	               a.CurrencyID,
	               a.CurrencyRate,
	               CASE 
	                    WHEN pa.Amount + ISNULL(pa.Addition, 0) > 0 THEN 0
	                    ELSE ABS(pa.Amount + ISNULL(pa.Addition, 0))
	               END     CurrencyDebit,
	               CASE 
	                    WHEN pa.Amount + ISNULL(pa.Addition, 0) > 0 THEN ABS(pa.Amount + ISNULL(pa.Addition, 0))
	                    ELSE 0
	               END     CurrencyCredit,
	               1,
	               @CreatorId,
	               GETDATE(),
	               @CreatorId,
	               GETDATE(),
	               0,
	               'ConfirmStatement',
	               a.ConfirmStatementID
	        FROM   #ConfirmStatement a
	               JOIN #PayableAccount pa
	                    ON  a.ConfirmStatementID = pa.ConfirmStatementID
	        WHERE  a.CompanyRoll = 1
	               AND pa.AmountInBaseCurrency + ISNULL(pa.AdditionInBaseCurrency, 0) <> 0
	    END
	    
	    -----------------------------------insert Debit Of Payable Accounts For Deductions------------------
	    IF @PurchasePrevoucherIsNet = 0
	    BEGIN
	        INSERT INTO acc.PreVoucherItem
	               (
	                   PreVoucherID,
	                   RowIndex,
	                   SlID,
	                   [Description],
	                   Description2,
	                   Debit,
	                   Credit,
	                   CurrencyID,
	                   CurrencyRate,
	                   CurrencyDebit,
	                   CurrencyCredit,
	                   IsAutoGenerated,
	                   Creator,
	                   CreationDate,
	                   LastEditor,
	                   LastEditionDate,
	                   Version,
	                   BaseDocumentName,
	                   BaseDocumentID
	               )
	        SELECT a.PrevoucherID,
	               1,
	               a.PayableAccountSlId,
	               a.PayableAccountsVsDeductionDescription,
	               a.PayableAccountsVsDeductionDescription2,
	               b.DeductionInBaseCurrency,
	               0,
	               a.CurrencyID,
	               a.CurrencyRate,
	               b.Deduction,
	               0,
	               1,
	               @CreatorId,
	               GETDATE(),
	               @CreatorId,
	               GETDATE(),
	               0,
	               'ConfirmStatement',
	               a.ConfirmStatementID
	        FROM   #ConfirmStatement a
	               JOIN (
	                        SELECT ConfirmStatementID,
	                               SUM(Deduction) Deduction,
	                               SUM(DeductionInBaseCurrency) DeductionInBaseCurrency
	                        FROM   #Deduction
	                        GROUP BY
	                               ConfirmStatementID
	                    )b
	                    ON  a.ConfirmStatementID = b.ConfirmStatementID
	        WHERE  a.CompanyRoll = 1
	    END
	    -----------------------------------insert Deduction------------------
	    INSERT INTO ACC.PreVoucherItem
	           (
	               PreVoucherID,
	               RowIndex,
	               SlID,
	               DESCRIPTION,
	               Description2,
	               Debit,
	               Credit,
	               CurrencyID,
	               CurrencyRate,
	               CurrencyDebit,
	               CurrencyCredit,
	               Creator,
	               CreationDate,
	               LastEditor,
	               LastEditionDate,
	               Version,
	               BaseDocumentName,
	               BaseDocumentID
	           )
	    SELECT PreVoucherId,
	           1,
	           SlID,
	           DESCRIPTION,
	           Description2,
	           0,
	           DeductionInBaseCurrency,
	           CurrencyId,
	           currencyrate,
	           0,
	           Deduction,
	           @CreatorId,
	           GETDATE(),
	           @CreatorId,
	           GETDATE(),
	           0,
	           'ConfirmStatementItem',
	           ConfirmStatementItemID
	    FROM   #Deduction
	    WHERE  CompanyRoll = 1
	    -----------------------------------insert Debit Of Payable Accounts For Prepayment------------------
	    IF @PurchasePrevoucherIsNet = 0
	    BEGIN
	        INSERT INTO acc.PreVoucherItem
	               (
	                   PreVoucherID,
	                   RowIndex,
	                   SlID,
	                   [Description],
	                   Description2,
	                   Debit,
	                   Credit,
	                   CurrencyID,
	                   CurrencyRate,
	                   CurrencyDebit,
	                   CurrencyCredit,
	                   IsAutoGenerated,
	                   Creator,
	                   CreationDate,
	                   LastEditor,
	                   LastEditionDate,
	                   Version,
	                   BaseDocumentName,
	                   BaseDocumentID
	               )
	        SELECT a.PrevoucherID,
	               1,
	               a.PayableAccountSlId,
	               a.PayableAccountsVsPrepaymentDescription,
	               a.PayableAccountsVsPrepaymentDescription2,
	               PriceInBaseCurrencyWithConfirmStatementRate,
	               0,
	               a.CurrencyID,
	               a.CurrencyRate,
	               b.Price,
	               0,
	               1,
	               @CreatorId,
	               GETDATE(),
	               @CreatorId,
	               GETDATE(),
	               0,
	               'ConfirmStatement',
	               a.ConfirmStatementID
	        FROM   #ConfirmStatement a
	               JOIN cfg.Currency h
	                    ON  h.CurrencyID = a.CurrencyID
	               JOIN #ConfirmStatementPrePaymentSum b
	                    ON  a.ConfirmStatementID = b.ConfirmStatementID
	        WHERE  a.CompanyRoll = 1
	    END
	    -----------------------------------insert prepayment------------------
	    INSERT INTO ACC.PreVoucherItem
	           (
	               PreVoucherID,
	               RowIndex,
	               SlID,
	               DESCRIPTION,
	               Description2,
	               Debit,
	               Credit,
	               CurrencyID,
	               CurrencyRate,
	               CurrencyDebit,
	               CurrencyCredit,
	               Creator,
	               CreationDate,
	               LastEditor,
	               LastEditionDate,
	               Version,
	               BaseDocumentName,
	               BaseDocumentID
	           )
	    SELECT PreVoucherId,
	           1,
	           SlID,
	           DESCRIPTION,
	           Description2,
	           0,
	           PriceInBaseCurrency,
	           CurrencyId,
	           currencyrate,
	           0,
	           Price,
	           @CreatorId,
	           GETDATE(),
	           @CreatorId,
	           GETDATE(),
	           0,
	           'ConfirmStatementPrePayment',
	           ConfirmStatementPrePaymentID
	    FROM   #ConfirmStatementPrePayment
	    WHERE  CompanyRoll = 1
	    -----------------------------------insert AllocationSharingAmount------------------
	    UPDATE h
	    SET    ErrorMessage = 'ExchangeGainLossSlIDIsNotSpecifiedInAdditionDeduction' + h.ContractStatementTypeTitle + 
	           CHAR(10) + CHAR(13)
	    FROM   cnt.ConfirmStatementItem a
	           JOIN cnt.AdditionDeductionTypeMethod b
	                ON  a.AdditionDeductionTypeMethodID = b.AdditionDeductionTypeMethodID
	           JOIN #ConfirmStatement h
	                ON  h.ConfirmStatementID = a.ConfirmStatementID
	    WHERE  a.AllocationSharingAmount <> 0
	           AND h.CompanyRoll = 1
	           AND b.ExchangeGainLossSlID is null
	           AND @ExchangeManner = 1
	    
	    IF EXISTS (
	           SELECT *
	           FROM   #ConfirmStatement
	           WHERE  ErrorMessage is NOT null
	       )
	    BEGIN
	        SELECT ConfirmStatementID,
	               ErrorMessage
	        FROM   #ConfirmStatement
	        
	        RETURN;
	    END
	    
	    IF @ExchangeManner = 1
	    BEGIN
	        INSERT INTO acc.PreVoucherItem
	               (
	                   PreVoucherID,
	                   RowIndex,
	                   SlID,
	                   [Description],
	                   Description2,
	                   Debit,
	                   Credit,
	                   CurrencyID,
	                   CurrencyRate,
	                   CurrencyDebit,
	                   CurrencyCredit,
	                   IsAutoGenerated,
	                   Creator,
	                   CreationDate,
	                   LastEditor,
	                   LastEditionDate,
	                   Version
	               )
	        SELECT h.PrevoucherID,
	               1,
	               b.ExchangeGainLossSlID,
	               h.AllocationSharingDescription,
	               h.AllocationSharingDescription2,
	               CASE 
	                    WHEN a.AllocationSharingAmount > 0 THEN ABS(a.AllocationSharingAmount)
	                    ELSE 0
	               END,
	               CASE 
	                    WHEN a.AllocationSharingAmount < 0 THEN ABS(a.AllocationSharingAmount)
	                    ELSE 0
	               END,
	               -1,
	               1,
	               CASE 
	                    WHEN a.AllocationSharingAmount > 0 THEN ABS(a.AllocationSharingAmount)
	                    ELSE 0
	               END,
	               CASE 
	                    WHEN a.AllocationSharingAmount < 0 THEN ABS(a.AllocationSharingAmount)
	                    ELSE 0
	               END,
	               1,
	               @CreatorId,
	               GETDATE(),
	               @CreatorId,
	               GETDATE(),
	               1
	        FROM   cnt.ConfirmStatementItem a
	               JOIN cnt.AdditionDeductionTypeMethod b
	                    ON  a.AdditionDeductionTypeMethodID = b.AdditionDeductionTypeMethodID
	               JOIN #ConfirmStatement h
	                    ON  h.ConfirmStatementID = a.ConfirmStatementID
	        WHERE  a.AllocationSharingAmount <> 0
	               AND h.CompanyRoll = 1
	    END
	    
	    IF @ExchangeManner = 2
	    BEGIN
	        SELECT h.PrevoucherID,
	               a.ConfirmStatementID,
	               a.ConfirmStatementItemID,
	               AllocationSharingDescription,
	               AllocationSharingDescription2,
	               b.SlID,
	               ROUND(
	                   (
	                       convert(FLOAT, b.Amount) / convert(
	                           FLOAT,
	                           SUM(b.amount) over(PARTITION by b.ConfirmStatementID)
	                       )
	                   ) 
	                   * a.AllocationSharingAmount,
	                   @BaseDigit
	               )     AllocationSharingAmount,
	               ROW_NUMBER() over(
	                   PARTITION by a.ConfirmStatementItemID order by b.ContractSubjectID
	               )     Rno,
	               h.CurrencyId
	        INTO   #T
	        FROM   cnt.ConfirmStatementItem a
	               JOIN #TItem b
	                    ON  a.ConfirmStatementID = b.ConfirmStatementID
	               JOIN #ConfirmStatement h
	                    ON  h.ConfirmStatementID = a.ConfirmStatementID
	        WHERE  a.AllocationSharingAmount <> 0
	               AND h.CompanyRoll = 1
	        
	        ;with cte as
	        (
	            SELECT a.ConfirmStatementItemID,
	                   a.AllocationSharingAmount - b.SumAllocationSharingAmount diff
	            FROM   cnt.ConfirmStatementItem a
	                   JOIN (
	                            SELECT ConfirmStatementItemID,
	                                   SUM(AllocationSharingAmount) SumAllocationSharingAmount
	                            FROM   #T
	                            GROUP BY
	                                   ConfirmStatementItemID
	                        )b
	                        ON  a.ConfirmStatementItemID = b.ConfirmStatementItemID
	            WHERE  a.AllocationSharingAmount <> b.SumAllocationSharingAmount
	        )
	        UPDATE #t
	        SET    AllocationSharingAmount = AllocationSharingAmount + diff
	        FROM   cte
	               JOIN #T
	                    ON  cte.ConfirmStatementItemID = #T.ConfirmStatementItemID
	                    AND #T.Rno = 1
	        
	        
	        
	        INSERT INTO acc.PreVoucherItem
	               (
	                   PreVoucherID,
	                   RowIndex,
	                   SlID,
	                   [Description],
	                   Description2,
	                   Debit,
	                   Credit,
	                   CurrencyID,
	                   CurrencyRate,
	                   CurrencyDebit,
	                   CurrencyCredit,
	                   IsAutoGenerated,
	                   Creator,
	                   CreationDate,
	                   LastEditor,
	                   LastEditionDate,
	                   Version
	               )
	        SELECT a.PrevoucherID,
	               1,
	               a.SlID,
	               a.AllocationSharingDescription,
	               a.AllocationSharingDescription2,
	               CASE 
	                    WHEN a.AllocationSharingAmount > 0 THEN ABS(a.AllocationSharingAmount)
	                    ELSE 0
	               END,
	               CASE 
	                    WHEN a.AllocationSharingAmount < 0 THEN ABS(a.AllocationSharingAmount)
	                    ELSE 0
	               END,
	               -1,
	               1,
	               CASE 
	                    WHEN a.AllocationSharingAmount > 0 THEN ABS(a.AllocationSharingAmount)
	                    ELSE 0
	               END,
	               CASE 
	                    WHEN a.AllocationSharingAmount < 0 THEN ABS(a.AllocationSharingAmount)
	                    ELSE 0
	               END,
	               1,
	               @CreatorId,
	               GETDATE(),
	               @CreatorId,
	               GETDATE(),
	               1
	        FROM   #T a
	        
	        END
	        
	        IF @PurchasePrevoucherIsNet <> 0
	        BEGIN
	            INSERT INTO acc.PreVoucherItem
	                   (
	                       PreVoucherID,
	                       RowIndex,
	                       SlID,
	                       [Description],
	                       Description2,
	                       Debit,
	                       Credit,
	                       CurrencyID,
	                       CurrencyRate,
	                       CurrencyDebit,
	                       CurrencyCredit,
	                       IsAutoGenerated,
	                       Creator,
	                       CreationDate,
	                       LastEditor,
	                       LastEditionDate,
	                       Version,
	                       BaseDocumentName,
	                       BaseDocumentID
	                   )
	            SELECT a.PrevoucherID,
	                   1,
	                   a.PayableAccountSlId,
	                   a.PayableAccountsVsStatementAndAdditionDescription,
	                   a.PayableAccountsVsStatementAndAdditionDescription2,
	                   CASE 
	                        WHEN pa.NetAmountInBaseCurrency > 0 THEN 0
	                        ELSE ABS(pa.NetAmountInBaseCurrency)
	                   END     Debit,
	                   CASE 
	                        WHEN pa.NetAmountInBaseCurrency > 0 THEN ABS(pa.NetAmountInBaseCurrency)
	                        ELSE 0
	                   END     Credit,
	                   a.CurrencyID,
	                   a.CurrencyRate,
	                   CASE 
	                        WHEN pa.NetAmount > 0 THEN 0
	                        ELSE ABS(pa.NetAmount)
	                   END     CurrencyDebit,
	                   CASE 
	                        WHEN pa.NetAmount > 0 THEN ABS(pa.NetAmount)
	                        ELSE 0
	                   END     CurrencyCredit,
	                   1,
	                   @CreatorId,
	                   GETDATE(),
	                   @CreatorId,
	                   GETDATE(),
	                   0,
	                   'ConfirmStatement',
	                   a.ConfirmStatementID
	            FROM   #ConfirmStatement a
	                   JOIN #PayableAccount pa
	                        ON  a.ConfirmStatementID = pa.ConfirmStatementID
	            WHERE  a.CompanyRoll = 1
	                   AND pa.NetAmountInBaseCurrency <> 0
	        END
	        -------------------------------insert Tax--------------------------------
	        INSERT INTO ACC.PreVoucherItem
	               (
	                   PreVoucherID,
	                   RowIndex,
	                   SlID,
	                   DESCRIPTION,
	                   Description2,
	                   Debit,
	                   Credit,
	                   CurrencyID,
	                   CurrencyRate,
	                   CurrencyDebit,
	                   CurrencyCredit,
	                   Creator,
	                   CreationDate,
	                   LastEditor,
	                   LastEditionDate,
	                   Version,
	                   BaseDocumentName,
	                   BaseDocumentID
	               )
	        SELECT PreVoucherId,
	               1,
	               TaxSLID,
				   TaxDescription,
				   TaxDescription2,
	               Tax,
	               0,
	               -1,
	               1,
	               Tax,
	               0,
	               @CreatorId,
	               GETDATE(),
	               @CreatorId,
	               GETDATE(),
	               0,
	               'ConfirmStatement',
	               cs.ConfirmStatementID
	        FROM   #ConfirmStatement cs
	        WHERE  CompanyRoll = 1
	               AND Tax > 0 
	        -------------------------------insert Duty--------------------------------	    	    
	        INSERT INTO ACC.PreVoucherItem
	               (
	                   PreVoucherID,
	                   RowIndex,
	                   SlID,
	                   DESCRIPTION,
	                   Description2,
	                   Debit,
	                   Credit,
	                   CurrencyID,
	                   CurrencyRate,
	                   CurrencyDebit,
	                   CurrencyCredit,
	                   Creator,
	                   CreationDate,
	                   LastEditor,
	                   LastEditionDate,
	                   Version,
	                   BaseDocumentName,
	                   BaseDocumentID
	               )
	        SELECT PreVoucherId,
	               1,
	               DutySLID,
	               DutyDescription,
	               DutyDescription2,
	               Duty,
	               0,
	               -1,
	               1,
	               Duty,
	               0,
	               @CreatorId,
	               GETDATE(),
	               @CreatorId,
	               @CreatorId,
	               0,
	               'ConfirmStatement',
	               ConfirmStatementID
	        FROM   #ConfirmStatement
	        WHERE  CompanyRoll = 1
	               AND Duty > 0 
	        -----------------------------------AccountsPayable insert For Vat------------------	
	        INSERT INTO acc.PreVoucherItem
	               (
	                   PreVoucherID,
	                   RowIndex,
	                   SlID,
	                   [Description],
	                   Description2,
	                   Debit,
	                   Credit,
	                   CurrencyID,
	                   CurrencyRate,
	                   CurrencyDebit,
	                   CurrencyCredit,
	                   IsAutoGenerated,
	                   Creator,
	                   CreationDate,
	                   LastEditor,
	                   LastEditionDate,
	                   Version,
	                   BaseDocumentName,
	                   BaseDocumentID
	               )
	        SELECT PreVoucherId,
	               1,
	               PayableAccountSlId,
	               PayableAccountsVsVatDescription,
	               PayableAccountsVsVatDescription2,
	               0,
	               Tax + Duty,
	               -1,
	               1,
	               0,
	               Tax + Duty,
	               1,
	               @CreatorId,
	               GETDATE(),
	               @CreatorId,
	               GETDATE(),
	               0,
	               'ConfirmStatement',
	               ConfirmStatementID
	        FROM   #ConfirmStatement
	        WHERE  CompanyRoll = 1
	               AND Tax + Duty <> 0
	        -----------------------------------PurchaseInvoice------------------
	        BEGIN
	        	DECLARE @PurchaseInvoiceID INT,
	        	        @Description2 NVARCHAR(MAX),
	        	        @PurchaseInvoiceDliD BIGINT,
	        	        @PurchaseInvoicePrevoucherID INT,
	        	        @ContractStatementID INT
	        	
	        	SELECT a.BaseDocumentID,
	        	       a.Description,
	        	       a.Description2,
	        	       h.ContractStatementID,
	        	       b.CurrencyID,
	        	       b.CurrencyRate,
	        	       cu.IsBaseCurrencyBasis,
	        	       cu.ExchangeUnit,
	        	       CASE 
	        	            WHEN cu.IsBaseCurrencyBasis = 0 THEN ROUND((TotalTax) * b.currencyrate / cu.ExchangeUnit, @BaseDigit)
	        	            WHEN cu.IsBaseCurrencyBasis = 1 THEN ROUND((TotalTax) * cu.ExchangeUnit / b.currencyrate, @BaseDigit)
	        	       END     TotalTax,
	        	       CASE 
	        	            WHEN cu.IsBaseCurrencyBasis = 0 THEN ROUND((TotalDuty) * b.currencyrate / cu.ExchangeUnit, @BaseDigit)
	        	            WHEN cu.IsBaseCurrencyBasis = 1 THEN ROUND((TotalDuty) * cu.ExchangeUnit / b.currencyrate, @BaseDigit)
	        	       END     TotalDuty,
	        	       P.title + ' ' + ISNULL(p.LastName, '') PartyTitle,
	        	       CAST(ISNULL(b.InvoiceNumber, '') AS NVARCHAR(MAX)) Number,
	        	       b.BaseType,
	        	       b.Date,
	        	       pt.SlID,
	        	       pt.TaxSlId,
	        	       pt.DutySlId,
	        	       CASE 
	        	            WHEN @CultureNO = 1 THEN pt.Title
	        	            ELSE pt.Title2
	        	       END     PurchaseTypeTitle,
	        	       b.DlID,
	        	       b.PreVoucherID,
	        	       b.PurchaseInvoiceID,
	        	       h.PayableAccountSlId,
	        	       pt.PurchaseTypeID
	        	INTO   #PurchaseInvoice
	        	FROM   cnt.ContractStatementDetail a
	        	       JOIN #ConfirmStatement h
	        	            ON  h.ContractStatementID = a.ContractStatementID
	        	       JOIN vnd.PurchaseInvoice b
	        	            ON  a.BaseDocumentType = 2
	        	            AND a.BaseDocumentID = b.PurchaseInvoiceID
	        	       JOIN cfg.party p
	        	            ON  p.DlID = b.DlID
	        	       JOIN vnd.PurchaseType pt
	        	            ON  pt.PurchaseTypeID = b.Type
	        	       JOIN cfg.Currency cu
	        	            ON  cu.CurrencyID = b.CurrencyID
	        	WHERE  h.CompanyRoll = 1
	        	
	        	UPDATE a
	        	SET    PreVoucherID = b.PreVoucherId
	        	FROM   VND.PurchaseInvoice a
	        	       JOIN #PurchaseInvoice b
	        	            ON  a.PurchaseInvoiceID = b.PurchaseInvoiceID
	        	
	        	UPDATE h
	        	SET    ErrorMessage = 'هیچ یک از فاکتورهای انتخاب شده نباید پیش نویس سند داشته باشند.' + CHAR(10) + CHAR(13)
	        	FROM   #ConfirmStatement h
	        	       JOIN #PurchaseInvoice p
	        	            ON  h.ContractStatementID = p.ContractStatementID
	        	WHERE  p.PreVoucherID is null
	        	
	        	UPDATE h
	        	SET    ErrorMessage = ErrorMessage + N'PreTaxSlNotSpecifiedInPurchaseType^' + p.PurchaseTypeTitle + 
	        	       CHAR(10) + CHAR(13)
	        	FROM   #ConfirmStatement h
	        	       JOIN #PurchaseInvoice p
	        	            ON  h.ContractStatementID = p.ContractStatementID
	        	WHERE  p.TaxSlId is null
	        	
	        	UPDATE h
	        	SET    ErrorMessage = ErrorMessage + N'PreDutySlNotSpecifiedInPurchaseType^' + p.PurchaseTypeTitle + 
	        	       CHAR(10) + CHAR(13)
	        	FROM   #ConfirmStatement h
	        	       JOIN #PurchaseInvoice p
	        	            ON  h.ContractStatementID = p.ContractStatementID
	        	WHERE  p.DutySlId is null
	        	
	        	IF EXISTS (
	        	       SELECT *
	        	       FROM   #ConfirmStatement
	        	       WHERE  ErrorMessage is NOT null
	        	   )
	        	BEGIN
	        	    SELECT ConfirmStatementID,
	        	           ErrorMessage
	        	    FROM   #ConfirmStatement
	        	    
	        	    RETURN;
	        	END
	        	
	        	-------------------------------------------------get deduction values------------------------------------------------
	        	SELECT m.SlID,
	        	       cs.Deduction,
	        	       CASE 
	        	            WHEN h.IsBaseCurrencyBasis = 0 THEN ROUND(cs.Deduction * h.CurrencyRate / h.ExchangeUnit, @BaseDigit)
	        	            WHEN h.IsBaseCurrencyBasis = 1 THEN ROUND(cs.Deduction * h.ExchangeUnit / h.CurrencyRate, @BaseDigit)
	        	       END DeductionInBaseCurrency,
	        	       cs.Description,
	        	       cs.Description2,
	        	       h.PreVoucherID,
	        	       h.PurchaseInvoiceID,
	        	       h.CurrencyID,
	        	       h.CurrencyRate
	        	INTO   #PIDeduction
	        	FROM   cnt.ConfirmStatementItem cs
	        	       JOIN cnt.AdditionDeductionType adt
	        	            ON  adt.AdditionDeductionTypeID = cs.AdditionDeductionTypeID
	        	       JOIN cnt.AdditionDeductionTypeMethod m
	        	            ON  m.AdditionDeductionTypeMethodID = cs.AdditionDeductionTypeMethodID
	        	       JOIN #PurchaseInvoice h
	        	            ON  h.PurchaseInvoiceID = cs.PurchaseInvoiceID
	        	WHERE  adt.Type = 2
	        	       AND adt.Criterion <> 2 
	        	
	        	-----------------------------------insert PurchaseControl------------------
	        	SELECT CASE 
	        	            WHEN s.type = 1 THEN sd.SlID
	        	            ELSE sagpt.SlID
	        	       END                  Slid,
	        	       s.[Type]          AS StuffType,
	        	       s.Code            AS StuffCode,
	        	       It.Price - It.Discount net,
	        	       CASE 
	        	            WHEN h.IsBaseCurrencyBasis = 0 THEN ROUND(
	        	                     (It.Price - It.Discount) * h.CurrencyRate / h.ExchangeUnit,
	        	                     @BaseDigit
	        	                 )
	        	            WHEN h.IsBaseCurrencyBasis = 1 THEN ROUND(
	        	                     (It.Price - It.Discount) * h.ExchangeUnit / h.CurrencyRate,
	        	                     @BaseDigit
	        	                 )
	        	       END                  NetInBaseCurrency,
	        	       It.Tax + It.Duty     Vat,
	        	       CASE 
	        	            WHEN h.IsBaseCurrencyBasis = 0 THEN ROUND(
	        	                     (It.Tax + It.Duty) * h.CurrencyRate / h.ExchangeUnit,
	        	                     @BaseDigit
	        	                 )
	        	            WHEN h.IsBaseCurrencyBasis = 1 THEN ROUND(
	        	                     (It.Tax + It.Duty) * h.ExchangeUnit / h.CurrencyRate,
	        	                     @BaseDigit
	        	                 )
	        	       END                  VatInBaseCurrency,
	        	       it.[Description],
	        	       it.Description2,
	        	       h.PurchaseInvoiceID,
	        	       h.PreVoucherID
	        	INTO   #PIItem
	        	FROM   vnd.purchaseInvoiceItem It
	        	       JOIN #PurchaseInvoice h
	        	            ON  h.PurchaseInvoiceID = It.PurchaseInvoiceID
	        	       INNER JOIN STF.[Stuff] s
	        	            ON  it.StuffID = s.StuffID
	        	       INNER JOIN stf.StuffDetail sd
	        	            ON  s.StuffID = sd.StuffID
	        	       LEFT JOIN stf.StuffAccountGroup sag
	        	            ON  sd.StuffAccountGroupID = sag.StuffAccountGroupID
	        	       LEFT JOIN stf.StuffAccountGroupPurchaseType sagpt
	        	            ON  sagpt.StuffAccountGroupID = sag.StuffAccountGroupID
	        	            AND sagpt.PurchaseTypeID = h.PurchaseTypeID
	        	
	        	UPDATE h
	        	SET    ErrorMessage = ErrorMessage +
	        	       CASE 
	        	            WHEN p.BaseType = 9 THEN 'InterfaceSlOfOrderPricingNotSpecified'
	        	            WHEN i.StuffType = 0 THEN 'PurchaseControlSlNotSpecified^' + i.StuffCode
	        	            WHEN i.StuffType = 1 THEN 'CostSlInServiceNotSpecified^' + i.StuffCode
	        	       END +
	        	       CHAR(10) + CHAR(13)
	        	FROM   #ConfirmStatement h
	        	       JOIN #PurchaseInvoice p
	        	            ON  h.ContractStatementID = p.ContractStatementID
	        	       JOIN #PIItem i
	        	            ON  i.PurchaseInvoiceID = p.PurchaseInvoiceID
	        	WHERE  p.SlId is null
	        	
	        	IF EXISTS (
	        	       SELECT *
	        	       FROM   #ConfirmStatement
	        	       WHERE  ErrorMessage is NOT null
	        	   )
	        	BEGIN
	        	    SELECT ConfirmStatementID,
	        	           ErrorMessage
	        	    FROM   #ConfirmStatement
	        	    
	        	    RETURN;
	        	END
	        	
	        	INSERT INTO acc.PreVoucherItem
	        	       (
	        	           PreVoucherID,
	        	           RowIndex,
	        	           SlID,
	        	           [Description],
	        	           Description2,
	        	           Debit,
	        	           Credit,
	        	           CurrencyID,
	        	           CurrencyRate,
	        	           CurrencyDebit,
	        	           CurrencyCredit,
	        	           IsAutoGenerated,
	        	           Creator,
	        	           CreationDate,
	        	           LastEditor,
	        	           LastEditionDate,
	        	           Version,
	        	           BaseDocumentName,
	        	           BaseDocumentID
	        	       )
	        	SELECT PreVoucherID,
	        	       1,
	        	       SlID,
	        	       DESCRIPTION,
	        	       DESCRIPTION2,
	        	       NetInBaseCurrency,
	        	       0,
	        	       -1,
	        	       1,
	        	       NetInBaseCurrency,
	        	       0,
	        	       1,
	        	       @CreatorId,
	        	       GETDATE(),
	        	       @CreatorId,
	        	       GETDATE(),
	        	       1,
	        	       'PurchaseInvoice',
	        	       PurchaseInvoiceID
	        	FROM   #PIItem 
	        	
	        	-------------------------------insert Tax--------------------------------
	        	INSERT INTO ACC.PreVoucherItem
	        	       (
	        	           PreVoucherID,
	        	           RowIndex,
	        	           SlID,
	        	           DESCRIPTION,
	        	           Description2,
	        	           Debit,
	        	           Credit,
	        	           CurrencyID,
	        	           CurrencyRate,
	        	           CurrencyDebit,
	        	           CurrencyCredit,
	        	           Creator,
	        	           CreationDate,
	        	           LastEditor,
	        	           LastEditionDate,
	        	           Version,
	        	           BaseDocumentName,
	        	           BaseDocumentID
	        	       )
	        	SELECT PreVoucherId,
	        	       1,
	        	       TaxSlID,
	        	       DESCRIPTION,
	        	       Description2,
	        	       TotalTax,
	        	       0,
	        	       -1,
	        	       1,
	        	       TotalTax,
	        	       0,
	        	       @CreatorId,
	        	       GETDATE(),
	        	       @CreatorId,
	        	       GETDATE(),
	        	       0,
	        	       'PurchaseInvoice',
	        	       PurchaseInvoiceID
	        	FROM   #PurchaseInvoice
	        	WHERE  TotalTax > 0
	        	
	        	-------------------------------insert Duty--------------------------------	    	    
	        	INSERT INTO ACC.PreVoucherItem
	        	       (
	        	           PreVoucherID,
	        	           RowIndex,
	        	           SlID,
	        	           DESCRIPTION,
	        	           Description2,
	        	           Debit,
	        	           Credit,
	        	           CurrencyID,
	        	           CurrencyRate,
	        	           CurrencyDebit,
	        	           CurrencyCredit,
	        	           Creator,
	        	           CreationDate,
	        	           LastEditor,
	        	           LastEditionDate,
	        	           Version,
	        	           BaseDocumentName,
	        	           BaseDocumentID
	        	       )
	        	SELECT PreVoucherId,
	        	       1,
	        	       DutySlId,
	        	       DESCRIPTION,
	        	       Description2,
	        	       TotalDuty,
	        	       0,
	        	       -1,
	        	       1,
	        	       TotalDuty,
	        	       0,
	        	       @CreatorId,
	        	       GETDATE(),
	        	       @CreatorId,
	        	       @CreatorId,
	        	       0,
	        	       'PurchaseInvoice',
	        	       PurchaseInvoiceID
	        	FROM   #PurchaseInvoice
	        	WHERE  TotalDuty > 0
	        	
	        	-----------------------------------AccountsPayable insert------------------
	        	INSERT INTO acc.PreVoucherItem
	        	       (
	        	           PreVoucherID,
	        	           RowIndex,
	        	           SlID,
	        	           [Description],
	        	           Description2,
	        	           Debit,
	        	           Credit,
	        	           CurrencyID,
	        	           CurrencyRate,
	        	           CurrencyDebit,
	        	           CurrencyCredit,
	        	           IsAutoGenerated,
	        	           Creator,
	        	           CreationDate,
	        	           LastEditor,
	        	           LastEditionDate,
	        	           Version,
	        	           BaseDocumentName,
	        	           BaseDocumentID
	        	       )
	        	SELECT a.PreVoucherID,
	        	       1,
	        	       a.PayableAccountSlId,
	        	       a.Description,
	        	       a.Description2,
	        	       0,
	        	       CASE 
	        	            WHEN @PurchasePrevoucherIsNet = 0 THEN b.NetInBaseCurrency + b.VatInBaseCurrency
	        	            ELSE b.NetInBaseCurrency + b.VatInBaseCurrency - ISNULL(c.DeductionInBaseCurrency, 0)
	        	       END,
	        	       a.CurrencyID,
	        	       a.CurrencyRate,
	        	       0,
	        	       CASE 
	        	            WHEN @PurchasePrevoucherIsNet = 0 THEN b.Net + b.vat
	        	            ELSE b.Net + b.vat - ISNULL(c.Deduction, 0)
	        	       END,
	        	       1,
	        	       @CreatorId,
	        	       GETDATE(),
	        	       @CreatorId,
	        	       GETDATE(),
	        	       0,
	        	       'PurchaseInvoice',
	        	       a.PurchaseInvoiceID
	        	FROM   #PurchaseInvoice a
	        	       JOIN (
	        	                SELECT PurchaseInvoiceID,
	        	                       SUM(Net) Net,
	        	                       SUM(vat) vat,
	        	                       SUM(NetInBaseCurrency) NetInBaseCurrency,
	        	                       SUM(VatInBaseCurrency) VatInBaseCurrency
	        	                FROM   #PIItem
	        	                GROUP BY
	        	                       PurchaseInvoiceID
	        	            )b
	        	            ON  a.PurchaseInvoiceID = b.PurchaseInvoiceID
	        	       left JOIN (
	        	                SELECT PurchaseInvoiceID,
	        	                       SUM(Deduction) Deduction,
	        	                       SUM(DeductionInBaseCurrency) DeductionInBaseCurrency
	        	                FROM   #PIDeduction
	        	                GROUP BY
	        	                       PurchaseInvoiceID
	        	            )c
	        	            ON  c.PurchaseInvoiceID = a.PurchaseInvoiceID
	        	
	        	-----------------------------------Deduction insert------------------
	        	IF @PurchasePrevoucherIsNet = 0
	        	BEGIN
	        	    INSERT INTO acc.PreVoucherItem
	        	           (
	        	               PreVoucherID,
	        	               RowIndex,
	        	               SlID,
	        	               [Description],
	        	               Description2,
	        	               Debit,
	        	               Credit,
	        	               CurrencyID,
	        	               CurrencyRate,
	        	               CurrencyDebit,
	        	               CurrencyCredit,
	        	               IsAutoGenerated,
	        	               Creator,
	        	               CreationDate,
	        	               LastEditor,
	        	               LastEditionDate,
	        	               Version,
	        	               BaseDocumentName,
	        	               BaseDocumentID
	        	           )
	        	    SELECT a.PreVoucherID,
	        	           1,
	        	           a.PayableAccountSlId,
	        	           a.Description,
	        	           a.Description2,
	        	           c.DeductionInBaseCurrency,
	        	           0,
	        	           a.CurrencyID,
	        	           a.CurrencyRate,
	        	           c.Deduction,
	        	           0,
	        	           1,
	        	           @CreatorId,
	        	           GETDATE(),
	        	           @CreatorId,
	        	           GETDATE(),
	        	           0,
	        	           'PurchaseInvoice',
	        	           a.PurchaseInvoiceID
	        	    FROM   #PurchaseInvoice a
	        	           left JOIN (
	        	                    SELECT PurchaseInvoiceID,
	        	                           SUM(Deduction) Deduction,
	        	                           SUM(DeductionInBaseCurrency) DeductionInBaseCurrency
	        	                    FROM   #PIDeduction
	        	                    GROUP BY
	        	                           PurchaseInvoiceID
	        	                )c
	        	                ON  c.PurchaseInvoiceID = a.PurchaseInvoiceID
	        	END
	        	
	        	INSERT INTO acc.PreVoucherItem
	        	       (
	        	           PreVoucherID,
	        	           RowIndex,
	        	           SlID,
	        	           [Description],
	        	           Description2,
	        	           Debit,
	        	           Credit,
	        	           CurrencyID,
	        	           CurrencyRate,
	        	           CurrencyDebit,
	        	           CurrencyCredit,
	        	           IsAutoGenerated,
	        	           Creator,
	        	           CreationDate,
	        	           LastEditor,
	        	           LastEditionDate,
	        	           Version,
	        	           BaseDocumentName,
	        	           BaseDocumentID
	        	       )
	        	SELECT PreVoucherId,
	        	       1,
	        	       SLID,
	        	       DESCRIPTION,
	        	       DESCRIPTION,
	        	       0,
	        	       DeductionInBaseCurrency,
	        	       CurrencyId,
	        	       currencyrate,
	        	       0,
	        	       Deduction,
	        	       1,
	        	       @CreatorId,
	        	       GETDATE(),
	        	       @CreatorId,
	        	       GETDATE(),
	        	       0,
	        	       'PurchaseInvoice',
	        	       PurchaseInvoiceID
	        	FROM   #PIDeduction
	        	
	        	----------------------------------Revers AccountsPayable Parties------------------
	        	INSERT INTO acc.PreVoucherItem
	        	       (
	        	           PreVoucherID,
	        	           RowIndex,
	        	           SlID,
	        	           [Description],
	        	           Description2,
	        	           Debit,
	        	           Credit,
	        	           CurrencyID,
	        	           CurrencyRate,
	        	           CurrencyDebit,
	        	           CurrencyCredit,
	        	           IsAutoGenerated,
	        	           Creator,
	        	           CreationDate,
	        	           LastEditor,
	        	           LastEditionDate,
	        	           Version,
	        	           BaseDocumentName,
	        	           BaseDocumentID
	        	       )
	        	SELECT a.PreVoucherID,
	        	       1,
	        	       a.PayableAccountSlId,
	        	       a.Description,
	        	       a.Description2,
	        	       CASE 
	        	            WHEN @PurchasePrevoucherIsNet = 0 THEN b.NetInBaseCurrency + b.VatInBaseCurrency
	        	            ELSE b.NetInBaseCurrency + b.VatInBaseCurrency - ISNULL(c.DeductionInBaseCurrency, 0)
	        	       END,
	        	       0,
	        	       a.CurrencyID,
	        	       a.CurrencyRate,
	        	       CASE 
	        	            WHEN @PurchasePrevoucherIsNet = 0 THEN b.Net + b.vat
	        	            ELSE b.Net + b.vat - ISNULL(c.Deduction, 0)
	        	       END,
	        	       0,
	        	       1,
	        	       @CreatorId,
	        	       GETDATE(),
	        	       @CreatorId,
	        	       GETDATE(),
	        	       0,
	        	       'PurchaseInvoice',
	        	       a.PurchaseInvoiceID
	        	FROM   #PurchaseInvoice a
	        	       JOIN (
	        	                SELECT PurchaseInvoiceID,
	        	                       SUM(Net) Net,
	        	                       SUM(vat) vat,
	        	                       SUM(NetInBaseCurrency) NetInBaseCurrency,
	        	                       SUM(VatInBaseCurrency) VatInBaseCurrency
	        	                FROM   #PIItem
	        	                GROUP BY
	        	                       PurchaseInvoiceID
	        	            )b
	        	            ON  a.PurchaseInvoiceID = b.PurchaseInvoiceID
	        	       left JOIN (
	        	                SELECT PurchaseInvoiceID,
	        	                       SUM(Deduction) Deduction,
	        	                       SUM(DeductionInBaseCurrency) DeductionInBaseCurrency
	        	                FROM   #PIDeduction
	        	                GROUP BY
	        	                       PurchaseInvoiceID
	        	            )c
	        	            ON  c.PurchaseInvoiceID = a.PurchaseInvoiceID
	        	
	        	
	        	INSERT INTO acc.PreVoucherItem
	        	       (
	        	           PreVoucherID,
	        	           RowIndex,
	        	           SlID,
	        	           [Description],
	        	           Description2,
	        	           Debit,
	        	           Credit,
	        	           CurrencyID,
	        	           CurrencyRate,
	        	           CurrencyDebit,
	        	           CurrencyCredit,
	        	           IsAutoGenerated,
	        	           Creator,
	        	           CreationDate,
	        	           LastEditor,
	        	           LastEditionDate,
	        	           Version
	        	       )
	        	SELECT a.PreVoucherID,
	        	       1,
	        	       a.PayableAccountSlId,
	        	       a.Description,
	        	       a.Description2,
	        	       0,
	        	       CASE 
	        	            WHEN @PurchasePrevoucherIsNet = 0 THEN b.NetInBaseCurrency + b.VatInBaseCurrency
	        	            ELSE b.NetInBaseCurrency + b.VatInBaseCurrency - ISNULL(c.DeductionInBaseCurrency, 0)
	        	       END,
	        	       a.CurrencyID,
	        	       a.CurrencyRate,
	        	       0,
	        	       CASE 
	        	            WHEN @PurchasePrevoucherIsNet = 0 THEN b.Net + b.vat
	        	            ELSE b.Net + b.vat - ISNULL(c.Deduction, 0)
	        	       END,
	        	       1,
	        	       @CreatorId,
	        	       GETDATE(),
	        	       @CreatorId,
	        	       GETDATE(),
	        	       0
	        	FROM   #PurchaseInvoice a
	        	       JOIN (
	        	                SELECT PurchaseInvoiceID,
	        	                       SUM(Net) Net,
	        	                       SUM(vat) vat,
	        	                       SUM(NetInBaseCurrency) NetInBaseCurrency,
	        	                       SUM(VatInBaseCurrency) VatInBaseCurrency
	        	                FROM   #PIItem
	        	                GROUP BY
	        	                       PurchaseInvoiceID
	        	            )b
	        	            ON  a.PurchaseInvoiceID = b.PurchaseInvoiceID
	        	       left JOIN (
	        	                SELECT PurchaseInvoiceID,
	        	                       SUM(Deduction) Deduction,
	        	                       SUM(DeductionInBaseCurrency) DeductionInBaseCurrency
	        	                FROM   #PIDeduction
	        	                GROUP BY
	        	                       PurchaseInvoiceID
	        	            )c
	        	            ON  c.PurchaseInvoiceID = a.PurchaseInvoiceID
	        END
	        -----------------------------------insert Other Costs------------------
	        INSERT INTO ACC.PreVoucherItem
	               (
	                   PreVoucherID,
	                   RowIndex,
	                   SlID,
	                   DESCRIPTION,
	                   Description2,
	                   Debit,
	                   Credit,
	                   CurrencyID,
	                   CurrencyRate,
	                   CurrencyDebit,
	                   CurrencyCredit,
	                   Creator,
	                   CreationDate,
	                   LastEditor,
	                   LastEditionDate,
	                   Version
	               )
	        SELECT PreVoucherId,
	               1,
	               SlID,
	               DESCRIPTION,
	               Description2,
	               AmountInBaseCurrency,
	               0,
	               CurrencyId,
	               currencyrate,
	               Amount,
	               0,
	               @CreatorId,
	               GETDATE(),
	               @CreatorId,
	               GETDATE(),
	               0
	        FROM   #OtherCosts
	        
	        INSERT INTO acc.PreVoucherItem
	               (
	                   PreVoucherID,
	                   RowIndex,
	                   SlID,
	                   [Description],
	                   Description2,
	                   Debit,
	                   Credit,
	                   CurrencyID,
	                   CurrencyRate,
	                   CurrencyDebit,
	                   CurrencyCredit,
	                   IsAutoGenerated,
	                   Creator,
	                   CreationDate,
	                   LastEditor,
	                   LastEditionDate,
	                   Version
	               )
	        SELECT PreVoucherId,
	               1,
	               PayableAccountSlId,
	               DESCRIPTION,
	               Description2,
	               0,
	               AmountInBaseCurrency,
	               CurrencyId,
	               currencyrate,
	               0,
	               Amount,
	               1,
	               @CreatorId,
	               GETDATE(),
	               @CreatorId,
	               GETDATE(),
	               0
	        FROM   #OtherCosts
	        
	        
	        END
	        
	        --CompanyRoll = 2
	        IF EXISTS (
	               SELECT 1
	               FROM   #ConfirmStatement
	               WHERE  CompanyRoll = 2
	           )
	        BEGIN
	            DECLARE @SalePrevoucherIsNet TINYINT
	            
	            SELECT @SalePrevoucherIsNet = CASE c.ConfigValue
	                                               WHEN 'true' THEN 1
	                                               ELSE 0
	                                          END
	            FROM   cfg.Configuration AS c
	            WHERE  c.ConfigKey = 'SalePrevoucherIsNet'
	            
	            IF @SalePrevoucherIsNet IS NULL
	            BEGIN
	                SET @SalePrevoucherIsNet = 1
	            END 
	            -----------------------------------ReceivableAccounts insert------------------
	            INSERT INTO acc.PreVoucherItem
	                   (
	                       PreVoucherID,
	                       RowIndex,
	                       SlID,
	                       [Description],
	                       Description2,
	                       Debit,
	                       Credit,
	                       CurrencyID,
	                       CurrencyRate,
	                       CurrencyDebit,
	                       CurrencyCredit,
	                       IsAutoGenerated,
	                       Creator,
	                       CreationDate,
	                       LastEditor,
	                       LastEditionDate,
	                       Version
	                   )
	            SELECT h.PrevoucherID,
	                   1,
	                   h.PayableAccountSlId,
	                   h.PayableAccountsVsStatementAndAdditionDescription,
	                   h.PayableAccountsVsStatementAndAdditionDescription2,
	                   CASE 
	                        WHEN @SalePrevoucherIsNet = 0 THEN CASE 
	                                                                WHEN pa.AmountInBaseCurrency + ISNULL(pa.AdditionInBaseCurrency, 0) 
	                                                                     > 0 THEN pa.AmountInBaseCurrency + ISNULL(pa.AdditionInBaseCurrency, 0)
	                                                                ELSE 0
	                                                           END
	                        ELSE CASE 
	                                  WHEN pa.NetAmountInBaseCurrency > 0 THEN pa.NetAmountInBaseCurrency
	                                  ELSE 0
	                             END
	                   END,
	                   CASE 
	                        WHEN @SalePrevoucherIsNet = 0 THEN CASE 
	                                                                WHEN pa.AmountInBaseCurrency + ISNULL(pa.AdditionInBaseCurrency, 0) 
	                                                                     < 0 THEN ABS(
	                                                                         pa.AmountInBaseCurrency + ISNULL(pa.AdditionInBaseCurrency, 0)
	                                                                     )
	                                                                ELSE 0
	                                                           END
	                        ELSE CASE 
	                                  WHEN pa.NetAmountInBaseCurrency < 0 THEN ABS(pa.NetAmountInBaseCurrency)
	                                  ELSE 0
	                             END
	                   END,
	                   h.CurrencyID,
	                   h.CurrencyRate,
	                   CASE 
	                        WHEN @SalePrevoucherIsNet = 0 THEN CASE 
	                                                                WHEN pa.Amount + ISNULL(pa.Addition, 0) > 0 THEN 
	                                                                     pa.Amount + ISNULL(pa.Addition, 0)
	                                                                ELSE 0
	                                                           END
	                        ELSE CASE 
	                                  WHEN pa.NetAmount > 0 THEN pa.NetAmount
	                                  ELSE 0
	                             END
	                   END,
	                   CASE 
	                        WHEN @SalePrevoucherIsNet = 0 THEN CASE 
	                                                                WHEN pa.Amount + ISNULL(pa.Addition, 0) < 0 THEN ABS(pa.Amount + ISNULL(pa.Addition, 0))
	                                                                ELSE 0
	                                                           END
	                        ELSE CASE 
	                                  WHEN pa.NetAmount < 0 THEN ABS(pa.NetAmount)
	                                  ELSE 0
	                             END
	                   END,
	                   1,
	                   @CreatorId,
	                   GETDATE(),
	                   @CreatorId,
	                   GETDATE(),
	                   0
	            FROM   #ConfirmStatement h
	                   JOIN #PayableAccount pa
	                        ON  h.ConfirmStatementID = pa.ConfirmStatementID
	            WHERE  h.CompanyRoll = 2
	                   AND CASE 
	                            WHEN @SalePrevoucherIsNet = 0 THEN pa.AmountInBaseCurrency + ISNULL(pa.AdditionInBaseCurrency, 0)
	                            ELSE pa.NetAmountInBaseCurrency
	                       END <> 0
	            
	            -----------------------------------ReceivableAccounts insert for deduction------------------
	            IF @SalePrevoucherIsNet = 0
	                INSERT INTO acc.PreVoucherItem
	                       (
	                           PreVoucherID,
	                           RowIndex,
	                           SlID,
	                           [Description],
	                           Description2,
	                           Debit,
	                           Credit,
	                           CurrencyID,
	                           CurrencyRate,
	                           CurrencyDebit,
	                           CurrencyCredit,
	                           IsAutoGenerated,
	                           Creator,
	                           CreationDate,
	                           LastEditor,
	                           LastEditionDate,
	                           Version
	                       )
	                SELECT h.PrevoucherID,
	                       1,
	                       h.PayableAccountSlId,
	                       h.PayableAccountsVsStatementAndAdditionDescription,
	                       h.PayableAccountsVsStatementAndAdditionDescription2,
	                       0,
	                       D.DeductionInBaseCurrency,
	                       h.CurrencyID,
	                       h.CurrencyRate,
	                       0,
	                       D.Deduction,
	                       1,
	                       @CreatorId,
	                       GETDATE(),
	                       @CreatorId,
	                       GETDATE(),
	                       0
	                FROM   #ConfirmStatement h
	                       JOIN (
	                                SELECT ConfirmStatementID,
	                                       SUM(DeductionInBaseCurrency) DeductionInBaseCurrency,
	                                       SUM(Deduction) Deduction
	                                FROM   #Deduction
	                                GROUP BY
	                                       ConfirmStatementID
	                            ) D
	                            ON  D.ConfirmStatementID = H.ConfirmStatementID
	                WHERE  h.CompanyRoll = 2
	                       AND D.DeductionInBaseCurrency <> 0
	            -----------------------------------insert Deduction------------------
	            INSERT INTO ACC.PreVoucherItem
	                   (
	                       PreVoucherID,
	                       RowIndex,
	                       SlID,
	                       DESCRIPTION,
	                       Description2,
	                       Debit,
	                       Credit,
	                       CurrencyID,
	                       CurrencyRate,
	                       CurrencyDebit,
	                       CurrencyCredit,
	                       Creator,
	                       CreationDate,
	                       LastEditor,
	                       LastEditionDate,
	                       Version
	                   )
	            SELECT PreVoucherId,
	                   1,
	                   SlID,
	                   DESCRIPTION,
	                   Description2,
	                   DeductionInBaseCurrency,
	                   0,
	                   CurrencyId,
	                   currencyrate,
	                   Deduction,
	                   0,
	                   @CreatorId,
	                   GETDATE(),
	                   @CreatorId,
	                   GETDATE(),
	                   0
	            FROM   #Deduction
	            WHERE  CompanyRoll = 2
	            -----------------------------------insert Advance Received------------------
	            INSERT INTO ACC.PreVoucherItem
	                   (
	                       PreVoucherID,
	                       RowIndex,
	                       SlID,
	                       DESCRIPTION,
	                       Description2,
	                       Debit,
	                       Credit,
	                       CurrencyID,
	                       CurrencyRate,
	                       CurrencyDebit,
	                       CurrencyCredit,
	                       Creator,
	                       CreationDate,
	                       LastEditor,
	                       LastEditionDate,
	                       Version,
	                       BaseDocumentName,
	                       BaseDocumentID
	                   )
	            SELECT PreVoucherId,
	                   1,
	                   SlID,
	                   DESCRIPTION,
	                   Description2,
	                   PriceInBaseCurrency,
	                   0,
	                   CurrencyId,
	                   currencyrate,
	                   Price,
	                   0,
	                   @CreatorId,
	                   GETDATE(),
	                   @CreatorId,
	                   GETDATE(),
	                   0,
	                   'ConfirmStatementPrePayment',
	                   ConfirmStatementPrePaymentID
	            FROM   #ConfirmStatementPrePayment
	            WHERE  CompanyRoll = 2
	            -----------------------------------insert Additions------------------
	            INSERT INTO ACC.PreVoucherItem
	                   (
	                       PreVoucherID,
	                       RowIndex,
	                       SlID,
	                       DESCRIPTION,
	                       Description2,
	                       Debit,
	                       Credit,
	                       CurrencyID,
	                       CurrencyRate,
	                       CurrencyDebit,
	                       CurrencyCredit,
	                       Creator,
	                       CreationDate,
	                       LastEditor,
	                       LastEditionDate,
	                       Version
	                   )
	            SELECT PreVoucherId,
	                   1,
	                   SlID,
	                   DESCRIPTION,
	                   DESCRIPTION,
	                   0,
	                   AdditionInBaseCurrency,
	                   CurrencyId,
	                   currencyrate,
	                   0,
	                   Addition,
	                   @CreatorId,
	                   GETDATE(),
	                   @CreatorId,
	                   GETDATE(),
	                   0
	            FROM   #Additions
	            WHERE  CompanyRoll = 2
	            -----------------------------------insert ContractSubjectSl------------------
	            INSERT INTO acc.PreVoucherItem
	                   (
	                       PreVoucherID,
	                       RowIndex,
	                       SlID,
	                       [Description],
	                       Description2,
	                       Debit,
	                       Credit,
	                       CurrencyID,
	                       CurrencyRate,
	                       CurrencyDebit,
	                       CurrencyCredit,
	                       IsAutoGenerated,
	                       Creator,
	                       CreationDate,
	                       LastEditor,
	                       LastEditionDate,
	                       Version
	                   )
	            SELECT PreVoucherID,
	                   1,
	                   SlID,
	                   DESCRIPTION,
	                   Description2,
	                   ABS(CASE WHEN Amount > 0 THEN 0 ELSE AmountInBaseCurrency END),
	                   ABS(CASE WHEN Amount > 0 THEN AmountInBaseCurrency ELSE 0 END),
	                   CurrencyId,
	                   currencyrate,
	                   ABS(CASE WHEN Amount > 0 THEN 0 ELSE Amount END),
	                   ABS(CASE WHEN Amount > 0 THEN Amount ELSE 0 END),
	                   1,
	                   @CreatorId,
	                   GETDATE(),
	                   @CreatorId,
	                   GETDATE(),
	                   1
	            FROM   #TItem
	            WHERE  Amount <> 0
	                   AND CompanyRoll = 2
	            -----------------------------------insert Debit Of Payable Accounts For Prepayment------------------
	            IF @SalePrevoucherIsNet = 0
	            BEGIN
	                INSERT INTO acc.PreVoucherItem
	                       (
	                           PreVoucherID,
	                           RowIndex,
	                           SlID,
	                           [Description],
	                           Description2,
	                           Debit,
	                           Credit,
	                           CurrencyID,
	                           CurrencyRate,
	                           CurrencyDebit,
	                           CurrencyCredit,
	                           IsAutoGenerated,
	                           Creator,
	                           CreationDate,
	                           LastEditor,
	                           LastEditionDate,
	                           Version,
	                           BaseDocumentName,
	                           BaseDocumentID
	                       )
	                SELECT a.PrevoucherID,
	                       1,
	                       a.PayableAccountSlId,
	                       a.PayableAccountsVsPrepaymentDescription,
	                       a.PayableAccountsVsPrepaymentDescription2,
	                       0,
	                       CASE 
	                            WHEN h.IsBaseCurrencyBasis = 0 THEN ROUND(b.Price * a.CurrencyRate / h.ExchangeUnit, @BaseDigit)
	                            WHEN h.IsBaseCurrencyBasis = 1 THEN ROUND(b.Price * h.ExchangeUnit / a.CurrencyRate, @BaseDigit)
	                       END,
	                       a.CurrencyID,
	                       a.CurrencyRate,
	                       0,
	                       b.Price,
	                       1,
	                       @CreatorId,
	                       GETDATE(),
	                       @CreatorId,
	                       GETDATE(),
	                       0,
	                       'ConfirmStatement',
	                       a.ConfirmStatementID
	                FROM   #ConfirmStatement a
	                       JOIN cfg.Currency h
	                            ON  h.CurrencyID = a.CurrencyID
	                       JOIN (
	                                SELECT ConfirmStatementID,
	                                       SUM(Price) Price,
	                                       SUM(PriceInBaseCurrency) PriceInBaseCurrency
	                                FROM   #ConfirmStatementPrePayment
	                                GROUP BY
	                                       ConfirmStatementID
	                            )b
	                            ON  a.ConfirmStatementID = b.ConfirmStatementID
	                WHERE  a.CompanyRoll = 2
	            END
	            -----------------------------------insert AllocationSharingAmount------------------
	            UPDATE h
	            SET    ErrorMessage = 'ExchangeGainLossSlIDIsNotSpecifiedInAdditionDeduction' + 
	                   h.ContractStatementTypeTitle + CHAR(10) + CHAR(13)
	            FROM   cnt.ConfirmStatementItem a
	                   JOIN cnt.AdditionDeductionTypeMethod b
	                        ON  a.AdditionDeductionTypeMethodID = b.AdditionDeductionTypeMethodID
	                   JOIN #ConfirmStatement h
	                        ON  h.ConfirmStatementID = a.ConfirmStatementID
	            WHERE  a.AllocationSharingAmount <> 0
	                   AND h.CompanyRoll = 2
	                   AND b.ExchangeGainLossSlID is null
	            
	            IF EXISTS (
	                   SELECT *
	                   FROM   #ConfirmStatement
	                   WHERE  ErrorMessage is NOT null
	               )
	            BEGIN
	                SELECT ConfirmStatementID,
	                       ErrorMessage
	                FROM   #ConfirmStatement
	                
	                RETURN;
	            END
	            
	            INSERT INTO acc.PreVoucherItem
	                   (
	                       PreVoucherID,
	                       RowIndex,
	                       SlID,
	                       [Description],
	                       Description2,
	                       Debit,
	                       Credit,
	                       CurrencyID,
	                       CurrencyRate,
	                       CurrencyDebit,
	                       CurrencyCredit,
	                       IsAutoGenerated,
	                       Creator,
	                       CreationDate,
	                       LastEditor,
	                       LastEditionDate,
	                       Version
	                   )
	            SELECT h.PrevoucherID,
	                   1,
	                   b.ExchangeGainLossSlID,
	                   h.AllocationSharingDescription,
	                   h.AllocationSharingDescription2,
	                   CASE 
	                        WHEN a.AllocationSharingAmount < 0 THEN ABS(a.AllocationSharingAmount)
	                        ELSE 0
	                   END,
	                   CASE 
	                        WHEN a.AllocationSharingAmount > 0 THEN ABS(a.AllocationSharingAmount)
	                        ELSE 0
	                   END,
	                   -1,
	                   1,
	                   CASE 
	                        WHEN a.AllocationSharingAmount < 0 THEN ABS(a.AllocationSharingAmount)
	                        ELSE 0
	                   END,
	                   CASE 
	                        WHEN a.AllocationSharingAmount > 0 THEN ABS(a.AllocationSharingAmount)
	                        ELSE 0
	                   END,
	                   1,
	                   @CreatorId,
	                   GETDATE(),
	                   @CreatorId,
	                   GETDATE(),
	                   1
	            FROM   cnt.ConfirmStatementItem a
	                   JOIN cnt.AdditionDeductionTypeMethod b
	                        ON  a.AdditionDeductionTypeMethodID = b.AdditionDeductionTypeMethodID
	                   JOIN #ConfirmStatement h
	                        ON  h.ConfirmStatementID = a.ConfirmStatementID
	            WHERE  a.AllocationSharingAmount <> 0
	                   AND h.CompanyRoll = 2
	            
	            -----------------------------------ReceivableAccounts insert For Vat ------------------
	            INSERT INTO acc.PreVoucherItem
	                   (
	                       PreVoucherID,
	                       RowIndex,
	                       SlID,
	                       [Description],
	                       Description2,
	                       Debit,
	                       Credit,
	                       CurrencyID,
	                       CurrencyRate,
	                       CurrencyDebit,
	                       CurrencyCredit,
	                       IsAutoGenerated,
	                       Creator,
	                       CreationDate,
	                       LastEditor,
	                       LastEditionDate,
	                       Version
	                   )
	            SELECT PreVoucherId,
	                   1,
	                   PayableAccountSlId,
	                   PayableAccountsVsVatDescription,
	                   PayableAccountsVsVatDescription2,
	                   Tax + Duty,
	                   0,
	                   -1,
	                   1,
	                   Tax + Duty,
	                   0,
	                   1,
	                   @CreatorId,
	                   GETDATE(),
	                   @CreatorId,
	                   GETDATE(),
	                   0
	            FROM   #ConfirmStatement h
	            WHERE  CompanyRoll = 2
	                   AND Tax + Duty <> 0
	            -------------------------------insert Tax--------------------------------
	            INSERT INTO ACC.PreVoucherItem
	                   (
	                       PreVoucherID,
	                       RowIndex,
	                       SlID,
	                       DESCRIPTION,
	                       Description2,
	                       Debit,
	                       Credit,
	                       CurrencyID,
	                       CurrencyRate,
	                       CurrencyDebit,
	                       CurrencyCredit,
	                       Creator,
	                       CreationDate,
	                       LastEditor,
	                       LastEditionDate,
	                       Version
	                   )
	            SELECT PreVoucherId,
	                   1,
					   TaxSlID,
					   TaxDescription,
					   TaxDescription2,
	                   0,
	                   Tax,
	                   -1,
	                   1,
	                   0,
	                   Tax,
	                   @CreatorId,
	                   GETDATE(),
	                   @CreatorId,
	                   GETDATE(),
	                   0
	            FROM   #ConfirmStatement cs
	            WHERE  CompanyRoll = 2
	                   AND tax <> 0
	            -------------------------------insert Duty--------------------------------	    	    
	            INSERT INTO ACC.PreVoucherItem
	                   (
	                       PreVoucherID,
	                       RowIndex,
	                       SlID,
	                       DESCRIPTION,
	                       Description2,
	                       Debit,
	                       Credit,
	                       CurrencyID,
	                       CurrencyRate,
	                       CurrencyDebit,
	                       CurrencyCredit,
	                       Creator,
	                       CreationDate,
	                       LastEditor,
	                       LastEditionDate,
	                       Version
	                   )
	            SELECT PreVoucherId,
	                   1,
	                   DutySLID,
	                   DutyDescription,
	                   DutyDescription2,
	                   0,
	                   Duty,
	                   -1,
	                   1,
	                   0,
	                   Duty,
	                   @CreatorId,
	                   GETDATE(),
	                   @CreatorId,
	                   @CreatorId,
	                   0
	            FROM   #ConfirmStatement
	            WHERE  CompanyRoll = 2
	                   AND Duty <> 0
	        END
	        
	        IF OBJECT_ID('tempdb..#PurchaseInvoice') is NOT null
	            INSERT INTO Acc.PreVoucherItemAccountLevel
	                   (
	                       PreVoucherItemID,
	                       AccountLevelID,
	                       DlID,
	                       [Value],
	                       Creator,
	                       CreationDate,
	                       LastEditor,
	                       LastEditionDate,
	                       Version
	                   )
	            SELECT b.PreVoucherItemID,
	                   als.AccountLevelID,
	                   dl.DLID,
	                   NULL,
	                   @CreatorId,
	                   GETDATE(),
	                   @CreatorId,
	                   GETDATE(),
	                   0
	            FROM   #PurchaseInvoice a
	                   JOIN acc.PreVoucherItem b
	                        ON  b.BaseDocumentName = 'PurchaseInvoice'
	                        AND b.BaseDocumentID = a.PurchaseInvoiceID
	                   JOIN Acc.AccountLevelSL als
	                        ON  als.SlID = b.Slid
	                   JOIN acc.dl dl
	                        ON  dl.DLID = a.DlID
	                        AND dl.DlTypeID = als.DlTypeID
	        
	        INSERT INTO Acc.PreVoucherItemAccountLevel
	               (
	                   PreVoucherItemID,
	                   AccountLevelID,
	                   DlID,
	                   [Value],
	                   Creator,
	                   CreationDate,
	                   LastEditor,
	                   LastEditionDate,
	                   Version
	               )
	        SELECT b.PreVoucherItemID,
	               als.AccountLevelID,
	               dl.DLID,
	               NULL,
	               @CreatorId,
	               GETDATE(),
	               @CreatorId,
	               GETDATE(),
	               0
	        FROM   #ConfirmStatement a
	               JOIN acc.PreVoucherItem b
	                    ON  b.PreVoucherID = a.PrevoucherID
	               JOIN Acc.AccountLevelSL als
	                    ON  als.SlID = b.Slid
	               JOIN acc.dl dl
	                    ON  dl.DLID = a.ContractDLID
	                    AND dl.DlTypeID = als.DlTypeID
	        
	        INSERT INTO Acc.PreVoucherItemAccountLevel
	               (
	                   PreVoucherItemID,
	                   AccountLevelID,
	                   DlID,
	                   [Value],
	                   Creator,
	                   CreationDate,
	                   LastEditor,
	                   LastEditionDate,
	                   Version
	               )
	        SELECT b.PreVoucherItemID,
	               als.AccountLevelID,
	               dl.DLID,
	               NULL,
	               @CreatorId,
	               GETDATE(),
	               @CreatorId,
	               GETDATE(),
	               0
	        FROM   #ConfirmStatement a
	               JOIN acc.PreVoucherItem b
	                    ON  b.PreVoucherID = a.PrevoucherID
	               JOIN Acc.AccountLevelSL als
	                    ON  als.SlID = b.Slid
	               JOIN acc.dl dl
	                    ON  dl.DLID = a.PartyDLID
	                    AND dl.DlTypeID = als.DlTypeID
	               left JOIN acc.PreVoucherItemAccountLevel pal
	                    ON  pal.PreVoucherItemID = b.PreVoucherItemID
	                    AND pal.AccountLevelID = als.AccountLevelID
	        WHERE  pal.PreVoucherItemAccountLevelID is null
	        
	        INSERT INTO Acc.PreVoucherItemAccountLevel
	               (
	                   PreVoucherItemID,
	                   AccountLevelID,
	                   DlID,
	                   [Value],
	                   Creator,
	                   CreationDate,
	                   LastEditor,
	                   LastEditionDate,
	                   Version
	               )
	        SELECT b.PreVoucherItemID,
	               als.AccountLevelID,
	               dl.DLID,
	               NULL,
	               @CreatorId,
	               GETDATE(),
	               @CreatorId,
	               GETDATE(),
	               0
	        FROM   #ConfirmStatement a
	               JOIN acc.PreVoucherItem b
	                    ON  b.PreVoucherID = a.PrevoucherID
	               JOIN Acc.AccountLevelSL als
	                    ON  als.SlID = b.Slid
	               JOIN acc.dl dl
	                    ON  dl.DLID = a.ProjectId
	                    AND dl.DlTypeID = als.DlTypeID
	               left JOIN acc.PreVoucherItemAccountLevel pal
	                    ON  pal.PreVoucherItemID = b.PreVoucherItemID
	                    AND pal.AccountLevelID = als.AccountLevelID
	        WHERE  pal.PreVoucherItemAccountLevelID is null

	        INSERT INTO Acc.PreVoucherItemAccountLevel
	               (
	                   PreVoucherItemID,
	                   AccountLevelID,
	                   DlID,
	                   [Value],
	                   Creator,
	                   CreationDate,
	                   LastEditor,
	                   LastEditionDate,
	                   Version
	               )
	        SELECT b.PreVoucherItemID,
	               als.AccountLevelID,
	               dl.DLID,
	               NULL,
	               @CreatorId,
	               GETDATE(),
	               @CreatorId,
	               GETDATE(),
	               0
	        FROM   #TItem a
	               JOIN acc.PreVoucherItem b
	                    ON  b.PreVoucherID = a.PrevoucherID
	               JOIN Acc.AccountLevelSL als
	                    ON  als.SlID = b.Slid
	               JOIN acc.dl dl
	                    ON  dl.DLID = a.LocationDlID
	                    AND dl.DlTypeID = als.DlTypeID
	               left JOIN acc.PreVoucherItemAccountLevel pal
	                    ON  pal.PreVoucherItemID = b.PreVoucherItemID
	                    AND pal.AccountLevelID = als.AccountLevelID
	        WHERE  pal.PreVoucherItemAccountLevelID is null
	        
	        ;with temp as 
	        (
	            SELECT [pi].PreVoucherItemID,
	                   ROW_NUMBER() over(PARTITION by PI.PreVoucherID order by PI.PreVoucherItemID) RowIndex,
	                   REPLACE(
	                       REPLACE(
	                           REPLACE(
	                               REPLACE(
	                                   REPLACE(
	                                       REPLACE(
	                                           REPLACE(
	                                               REPLACE(
	                                                   REPLACE(
	                                                       REPLACE(
	                                                           REPLACE(
	                                                               REPLACE(
	                                                                   REPLACE([pi].Description, '@@PartyTitle@@', i.PartyTitle),
	                                                                   '@@Number@@',
	                                                                   i.Number
	                                                               ),
	                                                               '@@Date_Gregorian@@',
	                                                               i.FullDateAlternateKey
	                                                           ),
	                                                           '@@Date_Solar@@',
	                                                           i.PersianFullDateAlternateKey
	                                                       ),
	                                                       '@@FromDate@@',
	                                                       i.FromDate
	                                                   ),
	                                                   '@@ToDate@@',
	                                                   i.ToDate
	                                               ),
	                                               '@@Currency@@',
	                                               i.CurrencyTitle
	                                           ),
	                                           '@@ContractStatementType@@',
	                                           i.ContractStatementType
	                                       ),
	                                       '@@ContractNumber@@',
	                                       i.ContractNumber
	                                   ),
	                                   '@@ContractTitle@@',
	                                   i.ContractTitle
	                               ),
	                               '@@ContractStatementNumber@@',
	                               i.ContractStatementNumber
	                           ),
	                           '@@ContractStatementADDate@@',
	                           i.ContractStatementDate
	                       ),
	                       '@@ContractStatementSolarDate@@',
	                       cfg.GetCLRSaturnDate(i.ContractStatementDate, 'yyyy/mm/dd', 0, 0)
	                   ) 
	                   [Description],
	                   REPLACE(
	                       REPLACE(
	                           REPLACE(
	                               REPLACE(
	                                   REPLACE(
	                                       REPLACE(
	                                           REPLACE(
	                                               REPLACE(
	                                                   REPLACE(
	                                                       REPLACE(
	                                                           REPLACE(
	                                                               REPLACE(
	                                                                   REPLACE([pi].Description2, '@@PartyTitle@@', i.PartyTitle2),
	                                                                   '@@Number@@',
	                                                                   i.Number
	                                                               ),
	                                                               '@@Date_Gregorian@@',
	                                                               i.FullDateAlternateKey
	                                                           ),
	                                                           '@@Date_Solar@@',
	                                                           i.PersianFullDateAlternateKey
	                                                       ),
	                                                       '@@FromDate@@',
	                                                       i.FromDate
	                                                   ),
	                                                   '@@ToDate@@',
	                                                   i.ToDate
	                                               ),
	                                               '@@Currency@@',
	                                               i.CurrencyTitle2
	                                           ),
	                                           '@@ContractStatementType@@',
	                                           i.ContractStatementType2
	                                       ),
	                                       '@@ContractNumber@@',
	                                       i.ContractNumber
	                                   ),
	                                   '@@ContractTitle@@',
	                                   i.ContractTitle2
	                               ),
	                               '@@ContractStatementNumber@@',
	                               i.ContractStatementNumber
	                           ),
	                           '@@ContractStatementADDate@@',
	                           i.ContractStatementDate
	                       ),
	                       '@@ContractStatementSolarDate@@',
	                       cfg.GetCLRSaturnDate(i.ContractStatementDate, 'yyyy/mm/dd', 0, 0)
	                   )
	                   [Description2]
	            FROM   #ConfirmStatement i
	                   JOIN acc.PreVoucherItem [pi]
	                        ON  [pi].PrevoucherID = i.PreVoucherID
	        )
	        
	        UPDATE v
	        SET    RowIndex = vi.RowIndex,
	               DESCRIPTION = vi.Description,
	               Description2 = vi.Description2
	        FROM   acc.PreVoucherItem v
	               JOIN temp vi
	                    ON  v.PreVoucherItemID = vi.PreVoucherItemID
	        
	        UPDATE a
	        SET    [Description]      = REPLACE(
	                   REPLACE(
	                       REPLACE(
	                           REPLACE(
	                               REPLACE(
	                                   REPLACE(
	                                       REPLACE(
	                                           REPLACE(
	                                               REPLACE(
	                                                   REPLACE(
	                                                       REPLACE(
	                                                           REPLACE(
	                                                               REPLACE(a.Description, '@@PartyTitle@@', b.PartyTitle),
	                                                               '@@Number@@',
	                                                               b.Number
	                                                           ),
	                                                           '@@Date_Gregorian@@',
	                                                           b.FullDateAlternateKey
	                                                       ),
	                                                       '@@Date_Solar@@',
	                                                       b.PersianFullDateAlternateKey
	                                                   ),
	                                                   '@@FromDate@@',
	                                                   b.FromDate
	                                               ),
	                                               '@@ToDate@@',
	                                               b.ToDate
	                                           ),
	                                           '@@Currency@@',
	                                           b.CurrencyTitle
	                                       ),
	                                       '@@ContractStatementType@@',
	                                       b.ContractStatementType
	                                   ),
	                                   '@@ContractNumber@@',
	                                   b.ContractNumber
	                               ),
	                               '@@ContractTitle@@',
	                               b.ContractTitle
	                           ),
	                           '@@ContractStatementNumber@@',
	                           b.ContractStatementNumber
	                       ),
	                       '@@ContractStatementADDate@@',
	                       b.ContractStatementDate
	                   ),
	                   '@@ContractStatementSolarDate@@',
	                   cfg.GetCLRSaturnDate(b.ContractStatementDate, 'yyyy/mm/dd', 0, 0)
	               ),
	               [Description2]     = REPLACE(
	                   REPLACE(
	                       REPLACE(
	                           REPLACE(
	                               REPLACE(
	                                   REPLACE(
	                                       REPLACE(
	                                           REPLACE(
	                                               REPLACE(
	                                                   REPLACE(
	                                                       REPLACE(
	                                                           REPLACE(
	                                                               REPLACE(a.Description2, '@@PartyTitle@@', b.PartyTitle2),
	                                                               '@@Number@@',
	                                                               b.Number
	                                                           ),
	                                                           '@@Date_Gregorian@@',
	                                                           b.FullDateAlternateKey
	                                                       ),
	                                                       '@@Date_Solar@@',
	                                                       b.PersianFullDateAlternateKey
	                                                   ),
	                                                   '@@FromDate@@',
	                                                   b.FromDate
	                                               ),
	                                               '@@ToDate@@',
	                                               b.ToDate
	                                           ),
	                                           '@@Currency@@',
	                                           b.CurrencyTitle2
	                                       ),
	                                       '@@ContractStatementType@@',
	                                       b.ContractStatementType2
	                                   ),
	                                   '@@ContractNumber@@',
	                                   b.ContractNumber
	                               ),
	                               '@@ContractTitle@@',
	                               b.ContractTitle2
	                           ),
	                           '@@ContractStatementNumber@@',
	                           b.ContractStatementNumber
	                       ),
	                       '@@ContractStatementADDate@@',
	                       b.ContractStatementDate
	                   ),
	                   '@@ContractStatementSolarDate@@',
	                   cfg.GetCLRSaturnDate(b.ContractStatementDate, 'yyyy/mm/dd', 0, 0)
	               )
	        FROM   acc.PreVoucher a
	               JOIN #ConfirmStatement b
	                    ON  a.PrevoucherID = b.PrevoucherID
