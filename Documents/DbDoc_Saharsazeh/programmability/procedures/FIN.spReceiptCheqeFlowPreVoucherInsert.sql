	
------------Start of #8110
CREATE   PROCEDURE [FIN].spReceiptCheqeFlowPreVoucherInsert
@ReceiptCheqeFlowId NVARCHAR(MAX)
	 --WITH ENCRYPTION
AS
	DECLARE @DocumentNumTypeId               INT = (
	            SELECT DocumentNumTypeID
	            FROM   CFG.DocumentNumType
	            WHERE  EngName = 'ReceiptCheqeFlow'
	        ),
	        @MDEntityBankOperation           INT = (
	            SELECT TOP 1             Id
	            FROM   mdt.DmdEntity  AS de
	            WHERE  NAME = 'BankOperation'
	        ),
	        @MDEntityDrawBackReceivedCheqe INT = (
	            SELECT TOP 1             Id
	            FROM   mdt.DmdEntity  AS de
	            WHERE  NAME = 'DrawBackReceivedCheqe'
	        ),
	        @MDEntityReceivedCheqeCashing INT = (
	            SELECT TOP 1             Id
	            FROM   mdt.DmdEntity  AS de
	            WHERE  NAME = 'ReceivedCheqeCashing'
	        ),
			@FirstDataLanguage				 VARCHAR(2),
            @SecondDataLanguage				 VARCHAR(2),
	        @MaxPrevoucherID                 INT,
	        @CreatorId                       INT,
	        @ByProtestedDocumentSl           INT,
	        @AssignToBankSlID                INT,
	        @ReceivableAccountsSlID			 INT,
	        @Culture                         VARCHAR(10),
	        @BaseDigit                       INT,
	        @HeaderDescriptionReceivedCheqeCashing NVARCHAR(MAX),
	        @HeaderDescriptionReceivedCheqeCashing2 NVARCHAR(MAX),
	        @HeaderDescriptionDrawBackReceivedCheqe NVARCHAR(MAX),
	        @HeaderDescriptionDrawBackReceivedCheqe2 NVARCHAR(MAX),
	        @HeaderDescriptionBankOperation NVARCHAR(MAX),
	        @HeaderDescriptionBankOperation2 NVARCHAR(MAX),
	        @CashDescription                 NVARCHAR(MAX),
	        @CashDescription2                NVARCHAR(MAX),
	        @BankDescriptionBankOperation NVARCHAR(MAX),
	        @BankDescriptionBankOperation2 NVARCHAR(MAX),
	        @BankDescriptionReceivedCheqeCashing NVARCHAR(MAX),
	        @BankDescriptionReceivedCheqeCashing2 NVARCHAR(MAX),
	        @ByProtestedDocumentsDescriptionBankOperation NVARCHAR(MAX),
	        @ByProtestedDocumentsDescriptionBankOperation2 NVARCHAR(MAX),
	        @ByProtestedDocumentsDescriptionDrawBackReceivedCheqe NVARCHAR(MAX),
	        @ByProtestedDocumentsDescriptionDrawBackReceivedCheqe2 NVARCHAR(MAX),
	        @ByProtestedDocumentsDescriptionReceivedCheqeCashing NVARCHAR(MAX),
	        @ByProtestedDocumentsDescriptionReceivedCheqeCashing2 NVARCHAR(MAX),
	        @AssignToBankDocumentsDescription  NVARCHAR(MAX),
	        @AssignToBankDocumentsDescription2 NVARCHAR(MAX),
	        @ReceivableDocumentsDescriptionBankOperation NVARCHAR(MAX),
	        @ReceivableDocumentsDescriptionBankOperation2 NVARCHAR(MAX),
	        @ReceivableDocumentsDescriptionDrawBackReceivedCheqe NVARCHAR(MAX),
	        @ReceivableDocumentsDescriptionDrawBackReceivedCheqe2 NVARCHAR(MAX),
	        @ReceivableDocumentsDescriptionReceivedCheqeCashing NVARCHAR(MAX),
	        @ReceivableDocumentsDescriptionReceivedCheqeCashing2 NVARCHAR(MAX),
	        @ReceivableAccountsDescription NVARCHAR(MAX),
	        @ReceivableAccountsDescription2 NVARCHAR(MAX),
	        @PayableAccountsDescription      NVARCHAR(MAX),
	        @PayableAccountsDescription2     NVARCHAR(MAX) ,  
			@AssignToBankOperation NVARCHAR(MAX),
			@AssignToBankOperation2 NVARCHAR(MAX),
			@CashAndProtestOperation NVARCHAR(MAX),
			@CashAndProtestOperation2 NVARCHAR(MAX),
			@InitialAssignToBankOperation NVARCHAR(MAX),
			@InitialAssignToBankOperation2 NVARCHAR(MAX),
			@InitialProtestOperation NVARCHAR(MAX),
			@InitialProtestOperation2 NVARCHAR(MAX),
			@ReturnFromAssignmentOperation NVARCHAR(MAX),
			@ReturnFromAssignmentOperation2 NVARCHAR(MAX),
			@CashToBankOperation NVARCHAR(MAX),
			@CashToBankOperation2 NVARCHAR(MAX),
			@CashToFundOperation  NVARCHAR(MAX),
			@CashToFundOperation2  NVARCHAR(MAX),
			@ReturnedOfSpendOperation  NVARCHAR(MAX),
			@ReturnedOfSpendOperation2  NVARCHAR(MAX),
			@DrawBackOperation NVARCHAR(MAX),
			@DrawBackOperation2 NVARCHAR(MAX)

	SET @CreatorId = cfg.GetuserID();
	SET @BaseDigit = cfg.GetBaseCurrencyPrecision();
	SET @Culture = cfg.GetuserCulture();

	SELECT @FirstDataLanguage = Culture FROM cfg.CultureInfo WHERE CultureNo = 1 and Culture = @Culture
	SELECT @SecondDataLanguage = Culture FROM cfg.CultureInfo WHERE CultureNo = 2 and Culture = @Culture

	if @SecondDataLanguage is null set @SecondDataLanguage = @FirstDataLanguage

	SELECT	@AssignToBankOperation = LV.[Value] FROM cfg.LocalizeEnum L  --0
						             JOIN cfg.LocalizeEnumValue LV on L.LocalizeEnumID = LV.LocalizeEnumID 
						             WHERE L.Enum = 'CheqeStateInReceive'  
						             AND L.Item = 'AssignToBank' 
						             AND LV.Culture = @FirstDataLanguage

	SELECT	@AssignToBankOperation2 = LV.[Value] FROM cfg.LocalizeEnum L  --0
						              JOIN cfg.LocalizeEnumValue LV on L.LocalizeEnumID = LV.LocalizeEnumID 
						              WHERE L.Enum = 'CheqeStateInReceive'  
						              AND L.Item = 'AssignToBank' 
								      AND LV.Culture = @SecondDataLanguage
	SELECT	@CashAndProtestOperation  =  LV.[Value] --5
									 	 FROM cfg.LocalizeEnum L
									     JOIN cfg.LocalizeEnumValue LV on L.LocalizeEnumID = LV.LocalizeEnumID
									 	 WHERE L.Enum = 'CheqeOperationTypeInReceive'
									 	 AND L.Item = 'CashAndProtest'
									 	 AND LV.Culture = @FirstDataLanguage

	SELECT	@CashAndProtestOperation2  =   LV.[Value] --5
									 	   FROM cfg.LocalizeEnum L
									 		    JOIN cfg.LocalizeEnumValue LV on L.LocalizeEnumID = LV.LocalizeEnumID
									 	   WHERE L.Enum = 'CheqeOperationTypeInReceive'
									 			 AND L.Item = 'CashAndProtest'
									 	         AND LV.Culture = @SecondDataLanguage
	SELECT	@InitialAssignToBankOperation  = LV.[Value] --7
							 				FROM cfg.LocalizeEnum L
							 					JOIN cfg.LocalizeEnumValue LV on L.LocalizeEnumID = LV.LocalizeEnumID
							 				WHERE L.Enum = 'CheqeOperationTypeInReceive'
							 					AND L.Item = 'InitialAssignToBank'
							 					AND LV.Culture = @FirstDataLanguage

	SELECT	@InitialAssignToBankOperation2  = LV.[Value] --7
							 	   FROM cfg.LocalizeEnum L
							 	         JOIN cfg.LocalizeEnumValue LV on L.LocalizeEnumID = LV.LocalizeEnumID
							 	   WHERE L.Enum = 'CheqeOperationTypeInReceive'
							 	         AND L.Item = 'InitialAssignToBank'
							 	         AND LV.Culture = @SecondDataLanguage

	SELECT	@InitialProtestOperation = LV.[Value]  --8
							 	   FROM cfg.LocalizeEnum L
							 	         JOIN cfg.LocalizeEnumValue LV on L.LocalizeEnumID = LV.LocalizeEnumID
							 	   WHERE L.Enum = 'CheqeOperationTypeInReceive'
							 	         AND L.Item = 'InitialProtest'
							 	         AND LV.Culture = @FirstDataLanguage

	SELECT  @InitialProtestOperation2 = LV.[Value] --8
							 	   FROM cfg.LocalizeEnum L
							 	         JOIN cfg.LocalizeEnumValue LV on L.LocalizeEnumID = LV.LocalizeEnumID
							 	   WHERE L.Enum = 'CheqeOperationTypeInReceive'
							 	         AND L.Item = 'InitialProtest'
							 	         AND LV.Culture = @SecondDataLanguage

	SELECT  @ReturnFromAssignmentOperation  = LV.[Value] --10
							 	   FROM cfg.LocalizeEnum L
							 	         JOIN cfg.LocalizeEnumValue LV on L.LocalizeEnumID = LV.LocalizeEnumID
							 	   WHERE L.Enum = 'CheqeOperationTypeInReceive'
							 	         AND L.Item = 'ReturnFromAssignment'
							 	         AND LV.Culture = @FirstDataLanguage

	SELECT	@ReturnFromAssignmentOperation2  = LV.[Value] --10
							 	   FROM cfg.LocalizeEnum L
							 	         JOIN cfg.LocalizeEnumValue LV on L.LocalizeEnumID = LV.LocalizeEnumID
							 	   WHERE L.Enum = 'CheqeOperationTypeInReceive'
							 	         AND L.Item = 'ReturnFromAssignment'
							 	         AND LV.Culture = @SecondDataLanguage
	SELECT	@CashToBankOperation  = LV.Value  --2
								FROM cfg.LocalizeEnum L 
									  JOIN cfg.LocalizeEnumValue LV on L.LocalizeEnumID = LV.LocalizeEnumID 
								WHERE L.Enum = 'CheqeStateInReceive' 
									  AND L.Item = 'CashToBank' 
									  AND LV.Culture = @FirstDataLanguage

	SELECT @CashToBankOperation2  = LV.Value  --2
								FROM cfg.LocalizeEnum L 
									  JOIN cfg.LocalizeEnumValue LV on L.LocalizeEnumID = LV.LocalizeEnumID 
								WHERE L.Enum = 'CheqeStateInReceive' 
									  AND L.Item = 'CashToBank' 
									  AND LV.Culture = @SecondDataLanguage

	SELECT @CashToFundOperation = LV.Value --3
								FROM cfg.LocalizeEnum L 
									  JOIN cfg.LocalizeEnumValue LV on L.LocalizeEnumID = LV.LocalizeEnumID 
								WHERE L.Enum = 'CheqeStateInReceive' 
									  AND L.Item = 'CashToFund' 
									  AND LV.Culture = @FirstDataLanguage

	SELECT @CashToFundOperation2 = LV.Value --3
								FROM cfg.LocalizeEnum L 
									  JOIN cfg.LocalizeEnumValue LV on L.LocalizeEnumID = LV.LocalizeEnumID 
								WHERE L.Enum = 'CheqeStateInReceive' 
									  AND L.Item = 'CashToFund' 
									  AND LV.Culture = @SecondDataLanguage


	SELECT @ReturnedOfSpendOperation  = LV.Value  --4
								FROM cfg.LocalizeEnum L 
									  JOIN cfg.LocalizeEnumValue LV on L.LocalizeEnumID = LV.LocalizeEnumID 
								WHERE L.Enum = 'CheqeStateInReceive' 
									  AND L.Item = 'ReturnedOfSpend' 
									  AND LV.Culture = @FirstDataLanguage

	SELECT	@ReturnedOfSpendOperation2  =  LV.Value --4
								FROM cfg.LocalizeEnum L 
									  JOIN cfg.LocalizeEnumValue LV on L.LocalizeEnumID = LV.LocalizeEnumID 
								WHERE L.Enum = 'CheqeStateInReceive' 
									  AND L.Item = 'ReturnedOfSpend' 
									  AND LV.Culture = @SecondDataLanguage

	SELECT	@DrawBackOperation = LV.Value  --1
						FROM cfg.LocalizeEnum L 
							  JOIN cfg.LocalizeEnumValue LV on L.LocalizeEnumID = LV.LocalizeEnumID 
						WHERE L.Enum = 'CheqeStateInReceive' 
							  AND L.Item = 'DrawBack' 
							  AND LV.Culture = @FirstDataLanguage

	SELECT	@DrawBackOperation2 = LV.Value --1
						FROM cfg.LocalizeEnum L 
							  JOIN cfg.LocalizeEnumValue LV on L.LocalizeEnumID = LV.LocalizeEnumID 
						WHERE L.Enum = 'CheqeStateInReceive' 
							  AND L.Item = 'DrawBack' 
							  AND LV.Culture = @SecondDataLanguage
		
	SELECT [value] ID
	INTO   #DocumentIds
	FROM   cfg.R_FnCommaStr2Table(@ReceiptCheqeFlowId) 	
	
	SELECT @AssignToBankSlID = ConfigValue
	FROM   CFG.Configuration
	WHERE  ConfigKey = 'TheReceiptDocumentSl'
	
		SELECT @ReceivableAccountsSlID = ConfigValue
	FROM   CFG.Configuration
	WHERE  ConfigKey = 'ReceivableAccounts'
	
	SELECT @ByProtestedDocumentSl = ConfigValue
	FROM   CFG.Configuration
	WHERE  ConfigKey = 'ByProtestedDocumentSl'
	
	SELECT @HeaderDescriptionReceivedCheqeCashing = DESCRIPTION,
	       @HeaderDescriptionReceivedCheqeCashing2 = Description2
	FROM   CFG.[VoucherDescription]
	WHERE  MDEntityID     = @MDEntityReceivedCheqeCashing
	       AND [Key]      = 'Header'
	
	SELECT @HeaderDescriptionDrawBackReceivedCheqe = DESCRIPTION,
	       @HeaderDescriptionDrawBackReceivedCheqe2 = Description2
	FROM   CFG.[VoucherDescription]
	WHERE  MDEntityID     = @MDEntityDrawBackReceivedCheqe
	       AND [Key]      = 'Header'

	SELECT @HeaderDescriptionBankOperation = DESCRIPTION,
	       @HeaderDescriptionBankOperation2 = Description2
	FROM   CFG.[VoucherDescription]
	WHERE  MDEntityID     = @MDEntityBankOperation
	       AND [Key]      = 'Header'
	
	SELECT @ReceivableDocumentsDescriptionBankOperation = DESCRIPTION,
	       @ReceivableDocumentsDescriptionBankOperation2 = Description2
	FROM   CFG.[VoucherDescription]
	WHERE  MDEntityID     = @MDEntityBankOperation
	       AND [Key]      = 'ReceivableDocuments'
	
	SELECT @ReceivableDocumentsDescriptionDrawBackReceivedCheqe = DESCRIPTION,
	       @ReceivableDocumentsDescriptionDrawBackReceivedCheqe2 = Description2
	FROM   CFG.[VoucherDescription]
	WHERE  MDEntityID     = @MDEntityDrawBackReceivedCheqe
	       AND [Key]      = 'ReceivableDocuments'
	
	SELECT @ReceivableDocumentsDescriptionReceivedCheqeCashing = DESCRIPTION,
	       @ReceivableDocumentsDescriptionReceivedCheqeCashing2 = Description2
	FROM   CFG.[VoucherDescription]
	WHERE  MDEntityID     = @MDEntityReceivedCheqeCashing
	       AND [Key]      = 'ReceivableDocuments'
	
	SELECT @AssignToBankDocumentsDescription = DESCRIPTION,
	       @AssignToBankDocumentsDescription2 = Description2
	FROM   CFG.[VoucherDescription]
	WHERE  MDEntityID     = @MDEntityBankOperation
	       AND [Key]      = 'AssignToBankDocuments'
	
	SELECT @ReceivableAccountsDescription = DESCRIPTION,
	       @ReceivableAccountsDescription2 = Description2
	FROM   CFG.[VoucherDescription]
	WHERE  MDEntityID     = @MDEntityDrawBackReceivedCheqe
	       AND [Key]      = 'ReceivableAccounts'
	
	SELECT @BankDescriptionBankOperation = DESCRIPTION,
	       @BankDescriptionBankOperation2 = Description2
	FROM   CFG.[VoucherDescription]
	WHERE  MDEntityID     = @MDEntityBankOperation
	       AND [Key]      = 'Bank'
	
	SELECT @BankDescriptionReceivedCheqeCashing = DESCRIPTION,
	       @BankDescriptionReceivedCheqeCashing2 = Description2
	FROM   CFG.[VoucherDescription]
	WHERE  MDEntityID     = @MDEntityReceivedCheqeCashing
	       AND [Key]      = 'Bank'
	
	SELECT @ByProtestedDocumentsDescriptionBankOperation = DESCRIPTION,
	       @ByProtestedDocumentsDescriptionBankOperation2 = Description2
	FROM   CFG.[VoucherDescription]
	WHERE  MDEntityID     = @MDEntityBankOperation
	       AND [Key]      = 'ByProtestedDocuments'
	
	SELECT @ByProtestedDocumentsDescriptionReceivedCheqeCashing = DESCRIPTION,
	       @ByProtestedDocumentsDescriptionReceivedCheqeCashing2 = Description2
	FROM   CFG.[VoucherDescription]
	WHERE  MDEntityID     = @MDEntityReceivedCheqeCashing
	       AND [Key]      = 'ByProtestedDocuments'
	
	SELECT @ByProtestedDocumentsDescriptionDrawBackReceivedCheqe = DESCRIPTION,
	       @ByProtestedDocumentsDescriptionDrawBackReceivedCheqe2 = Description2
	FROM   CFG.[VoucherDescription]
	WHERE  MDEntityID     = @MDEntityDrawBackReceivedCheqe
	       AND [Key]      = 'ByProtestedDocuments'
	
	SELECT @CashDescription = DESCRIPTION,
	       @CashDescription2     = Description2
	FROM   CFG.[VoucherDescription]
	WHERE  MDEntityID            = @MDEntityReceivedCheqeCashing
	       AND [Key]             = 'Cash'
	
	SELECT @PayableAccountsDescription = DESCRIPTION,
	       @PayableAccountsDescription2     = Description2
	FROM   CFG.[VoucherDescription]
	WHERE  MDEntityID                       = @MDEntityDrawBackReceivedCheqe
	       AND [Key]                        = 'PayableAccounts'	
	
	SELECT @MaxPrevoucherID = MAX(PreVoucherID)
	FROM   acc.PreVoucher

	--- FetchValues ---
	SELECT ISNULL(@MaxPrevoucherID, 0) + ROW_NUMBER() OVER(ORDER BY rr.ReceiptCheqeFlowID) PrevoucherID,
	       rr.ReceiptCheqeFlowID,
	       rr.BranchID,
	       rr.FinancialPeriodID,
	       rr.[Type],
	       rr.PartyID,
	       rr.CashID,
	       rr.BankAccountID,
	       rr.date,
	       CAST(NULL AS VARCHAR(MAX))     ErrorMessage,
	       DD.FullDateAlternateKey,
	       DD.PersianFullDateAlternateKey,
	       ISNULL(rr.Number, rr.InnerNumber) Number,
	       p.dlid                         PartyDlID,
			case when rr.[Type] in (0,5,10) then @HeaderDescriptionBankOperation
					when rr.[Type] in (2,3) then @HeaderDescriptionReceivedCheqeCashing
					when rr.[Type] in (1,4,11) then @HeaderDescriptionReceivedCheqeCashing
				end Description,	
			case when rr.[Type] in (0,5,10) then @HeaderDescriptionBankOperation2
					when rr.[Type] in (2,3) then @HeaderDescriptionReceivedCheqeCashing2
					when rr.[Type] in (1,4,11) then @HeaderDescriptionReceivedCheqeCashing2
				end Description2
	INTO   #ReceiptCheqeFlow
	FROM   FIN.ReceiptCheqeFlow rr
	       JOIN #DocumentIds b
	            ON  rr.ReceiptCheqeFlowID = b.ID
	       JOIN cfg.DimDate DD
	            ON  DD.Date = rr.Date
	       LEFT JOIN cfg.party p
	            ON  p.partyid = rr.PartyID
	WHERE  rr.PreVoucherID IS NULL
	       AND rr.Type IN (0, 1, 2, 3, 4, 5, 10,11)
	
	SELECT rcf.ReceiptCheqeFlowID,
	       rcf.PrevoucherID,
	       rcfi.ReceiptCheqeFlowItemID,
	       rcfi.[State],
	       CASE 
	            WHEN pre.state = 8 THEN Pre2.[State]
	            ELSE Pre.[State]
	       END                           PreState,
	       rc.CurrencyID,
	       rc.CurrencyRate,
	       rc.Amount,
	       CASE 
	            WHEN IsBaseCurrencyBasis = 0 THEN ROUND(rc.Amount * Rc.CurrencyRate / cu.exchangeunit, @BaseDigit)
	            WHEN IsBaseCurrencyBasis = 1 THEN ROUND(rc.Amount * cu.exchangeunit / Rc.CurrencyRate, @BaseDigit)
	       END                           AmountInBaseCurrency,
	       CASE 
	            WHEN Commercial = 1 AND rcfi.[State] <> 7 THEN (
	                     SELECT TOP 1 ConfigValue
	                     FROM   CFG.Configuration f
	                     WHERE  f.ConfigKey = 'ReceivedDocumentSl'
	                 )
	            WHEN Commercial = 0 AND rcfi.[State] <> 7 THEN (
	                     SELECT TOP 1 ConfigValue
	                     FROM   CFG.Configuration f
	                     WHERE  f.ConfigKey = 'OtherReceivedDocumentSl'
	                 )
	            WHEN rcfi.[State] = 7 THEN (
	                     SELECT TOP 1 ConfigValue
	                     FROM   CFG.Configuration f
	                     WHERE  f.ConfigKey = 'ByProtestedDocumentSl'
	                 )
	       END                        AS SlID,
	       p.DlID                        PartyDlID,
	       AssingedBank.DlID          AssingedBankDlID,
	       c.DlID                        CashDlID,
	       PreAssingedBank.DlID          PreAssingedBankDlID,
	       AssingedBank.slid          AssingedBankSlID,
	       PreAssingedBank.slid          PreAssingedBankSlID,
	       cb.SLID                       CashSlID,	       
	       rc.Number,
	       rc.ReceivedCheqeID,
	       rcfi.PreviousFlow,
	       rcf.Type,
				REPLACE(
				REPLACE(
				REPLACE(
				@AssignToBankDocumentsDescription
				,'@@CheckDueDate_AD@@',DD.FullDateAlternateKey)			
				,'@@CheckDueDate_Solar@@',DD.PersianFullDateAlternateKey)
				,'@@CheckNumber@@',rc.Number) AssignToBankDocumentsDescription,
				REPLACE(
				REPLACE(
				REPLACE(
				@AssignToBankDocumentsDescription2
				,'@@CheckDueDate_AD@@',DD.FullDateAlternateKey)			
				,'@@CheckDueDate_Solar@@',DD.PersianFullDateAlternateKey)
				,'@@CheckNumber@@',rc.Number)  AssignToBankDocumentsDescription2,
				REPLACE(
				REPLACE(
				REPLACE(
				case when rcf.[Type] in (0,5,10) then @ReceivableDocumentsDescriptionBankOperation
					 when rcf.[Type] in (2,3) then @ReceivableDocumentsDescriptionReceivedCheqeCashing
					 when rcf.[Type] in (1,4,11) then @ReceivableDocumentsDescriptionDrawBackReceivedCheqe
				 end
				,'@@CheckNumber@@',rc.Number)
				,'@@CheckDueDate_AD@@',DD.FullDateAlternateKey)			
				,'@@CheckDueDate_Solar@@',DD.PersianFullDateAlternateKey) ReceivableDocumentsDescription,
				REPLACE(
				REPLACE(
				REPLACE(
				case when rcf.[Type] in (0,5,10) then @ReceivableDocumentsDescriptionBankOperation2
					 when rcf.[Type] in (2,3) then @ReceivableDocumentsDescriptionReceivedCheqeCashing2
					 when rcf.[Type] in (1,4,11) then @ReceivableDocumentsDescriptionDrawBackReceivedCheqe2
				 end 
				,'@@CheckNumber@@',rc.Number)
				,'@@CheckDueDate_AD@@',DD.FullDateAlternateKey)			
				,'@@CheckDueDate_Solar@@',DD.PersianFullDateAlternateKey) ReceivableDocumentsDescription2,
				REPLACE(
				REPLACE(
				REPLACE(
				case when rcf.[Type] in (0,5,10) then @BankDescriptionBankOperation
					 when rcf.[Type] in (2,3) then @BankDescriptionReceivedCheqeCashing
				 end 
				,'@@CheckNumber@@',rc.Number)
				,'@@CheckDueDate_AD@@',DD.FullDateAlternateKey)			
				,'@@CheckDueDate_Solar@@',DD.PersianFullDateAlternateKey) BankDescription,
				REPLACE(
				REPLACE(
				REPLACE(
				case when rcf.[Type] in (0,5,10) then @BankDescriptionBankOperation2
					 when rcf.[Type] in (2,3) then @BankDescriptionReceivedCheqeCashing2
				 end  
				,'@@CheckNumber@@',rc.Number)
				,'@@CheckDueDate_AD@@',DD.FullDateAlternateKey)			
				,'@@CheckDueDate_Solar@@',DD.PersianFullDateAlternateKey) BankDescription2,
				REPLACE(
				REPLACE(
				REPLACE(
				@CashDescription
				,'@@CheckNumber@@',rc.Number)
				,'@@CheckDueDate_AD@@',DD.FullDateAlternateKey)			
				,'@@CheckDueDate_Solar@@',DD.PersianFullDateAlternateKey) CashDescription,
				REPLACE(
				REPLACE(
				REPLACE(
				@CashDescription2 
				,'@@CheckNumber@@',rc.Number)
				,'@@CheckDueDate_AD@@',DD.FullDateAlternateKey)			
				,'@@CheckDueDate_Solar@@',DD.PersianFullDateAlternateKey) CashDescription2,
				REPLACE(
				REPLACE(
				REPLACE(
				case when rcf.[Type] in (0,5,10) then @ByProtestedDocumentsDescriptionBankOperation
					 when rcf.[Type] in (2,3) then    @ByProtestedDocumentsDescriptionReceivedCheqeCashing
					 when rcf.[Type] in (1,4,11) then    @ByProtestedDocumentsDescriptionDrawBackReceivedCheqe
				 end
				,'@@CheckNumber@@',rc.Number)
				,'@@CheckDueDate_AD@@',DD.FullDateAlternateKey)			
				,'@@CheckDueDate_Solar@@',DD.PersianFullDateAlternateKey) ByProtestedDocumentsDescription,
				REPLACE(
				REPLACE(
				REPLACE(
				case when rcf.[Type] in (0,5,10) then @ByProtestedDocumentsDescriptionBankOperation2
					 when rcf.[Type] in (2,3) then    @ByProtestedDocumentsDescriptionReceivedCheqeCashing2
					 when rcf.[Type] in (1,4,11) then    @ByProtestedDocumentsDescriptionDrawBackReceivedCheqe2
				 end 
				,'@@CheckNumber@@',rc.Number)
				,'@@CheckDueDate_AD@@',DD.FullDateAlternateKey)			
				,'@@CheckDueDate_Solar@@',DD.PersianFullDateAlternateKey) ByProtestedDocumentsDescription2,
				REPLACE(
				REPLACE(
				REPLACE(
				@ReceivableAccountsDescription
				,'@@CheckNumber@@',rc.Number)
				,'@@CheckDueDate_AD@@',DD.FullDateAlternateKey)			
				,'@@CheckDueDate_Solar@@',DD.PersianFullDateAlternateKey) ReceivableAccountsDescription,
				REPLACE(
				REPLACE(
				REPLACE(
				@ReceivableAccountsDescription2 
				,'@@CheckNumber@@',rc.Number)
				,'@@CheckDueDate_AD@@',DD.FullDateAlternateKey)			
				,'@@CheckDueDate_Solar@@',DD.PersianFullDateAlternateKey) ReceivableAccountsDescription2,
	       CASE 
	            WHEN rcf.type = 4 THEN rcf.PartyDlID
	       END                           CheckReturner
	INTO   #DocItems
	FROM   fin.ReceiptCheqeFlowItem rcfi
	       JOIN #ReceiptCheqeFlow rcf
	            ON  rcf.ReceiptCheqeFlowID = rcfi.ReceiptCheqeFlowID
	       JOIN fin.ReceivedCheqe rc
	            ON  rc.ReceivedCheqeID = rcfi.ReceivedCheqeID
	       JOIN cfg.DimDate DD
	            ON  DD.Date = rc.Date
	       JOIN cfg.Currency cu
	            ON  cu.CurrencyID = rc.CurrencyID
	       JOIN FIN.ReceiveReceipt rr
	            ON  rr.ReceiveReceiptID = rc.ReceiveReceiptID
	       JOIN cfg.Party p
	            ON  p.PartyID = rr.PartyID
	       LEFT JOIN fin.ReceiptCheqeFlowItem Pre
	            ON  pre.ReceiptCheqeFlowItemID = rcfi.PreviousFlow
	       LEFT JOIN fin.ReceiptCheqeFlowItem Pre2
	            ON  pre2.ReceiptCheqeFlowItemID = Pre.PreviousFlow
	       LEFT JOIN cfg.BankAccount  AssingedBank
	            ON  AssingedBank.BankAccountID = rcf.BankAccountID
	       LEFT JOIN (
	                SELECT ReceiptCheqeFlowItemid,
	                       b.DlID,
	                       b.SLID
	                FROM   fin.ReceiptCheqeFlowItem i
	                       JOIN fin.ReceiptCheqeFlow h
	                            ON  i.ReceiptCheqeFlowID = h.ReceiptCheqeFlowID
	                       JOIN cfg.BankAccount b
	                            ON  b.BankAccountID = h.BankAccountID
					where h.Type <> 10
	            ) PreAssingedBank
	            ON  PreAssingedBank.ReceiptCheqeFlowItemid = rcfi.PreviousFlow
	       LEFT JOIN cfg.CashBalance cb
	            ON  rcf.CashID = cb.CashID
	            AND rc.CurrencyID = cb.CurrencyID
	       LEFT JOIN cfg.Cash c
	            ON  c.CashID = rcf.CashID

		update a
		set ErrorMessage = N'AssignToBankSlIsNotSpecifiedInGeneralConfiguration'+char(10)+char(13)
		from #ReceiptCheqeFlow a
		join #DocItems b on a.ReceiptCheqeFlowID = b.ReceiptCheqeFlowID
		where  b.TYPE IN (0 ,5, 10) and @AssignToBankSlID is null

		update a
		set ErrorMessage = isnull(ErrorMessage,'') + N'ByProtestedDocumentSlIsNotSpecifiedInGeneralConfiguration'+char(10)+char(13)
		from #ReceiptCheqeFlow a
		join #DocItems b on a.ReceiptCheqeFlowID = b.ReceiptCheqeFlowID
		where  
		(
			(b.TYPE = 5 and State = 7)
			or
			(b.TYPE IN (0,1, 2, 3,10,11) and PreState = 7)
		)
		and @ByProtestedDocumentSl is null

		
		if exists (select * from #ReceiptCheqeFlow where ErrorMessage is not null )
	    BEGIN	
			select ReceiptCheqeFlowID,ErrorMessage from #ReceiptCheqeFlow
			RETURN;
	    END

	SELECT *
	INTO   #ReceiveSubject
	FROM   (
	           SELECT di.PrevoucherID,
	                  di.ReceiptCheqeFlowItemID,
	                  CASE WHEN di.Type = 11 then @ReceivableAccountsSlID else  r.SLID END SlID , ---- In case of posCheckes Return Receivable Account in Configuration7
	                  CASE 
	                       WHEN IsBaseCurrencyBasis = 0 THEN ROUND(
	                                (rs.Amount - ISNULL(pre.Amount, 0)) * Rs.CurrencyRate / c.exchangeunit,
	                                @BaseDigit
	                            )
	                       WHEN IsBaseCurrencyBasis = 1 THEN ROUND(
	                                (rs.Amount - ISNULL(pre.Amount, 0)) * c.exchangeunit / Rs.CurrencyRate,
	                                @BaseDigit
	                            )
	                  END     AmountInBaseCurrency,
	                  rs.CurrencyID,
	                  rs.CurrencyRate,
	                  rs.Amount - ISNULL(pre.Amount, 0) Amount,
	                  rs.Discount,
	                  CASE 
	                       WHEN IsBaseCurrencyBasis = 0 THEN ROUND(rs.Discount * Rs.CurrencyRate / c.exchangeunit, @BaseDigit)
	                       WHEN IsBaseCurrencyBasis = 1 THEN ROUND(rs.Discount * c.exchangeunit / Rs.CurrencyRate, @BaseDigit)
	                  END     DiscountInBaseCurrency,
	                  ReceivableAccountsDescription DESCRIPTION,
	                  ReceivableAccountsDescription2 Description2,
					  rs.DLID,
					  rs.ReceiveSubjectID
	           FROM   #DocItems di
	                  LEFT JOIN fin.ReceiveSubject rs
	                       ON  rs.ReceivedCheqeID = di.ReceivedCheqeID
	                  LEFT JOIN fin.ReceiptType r
	                       ON  rs.ReceiptTypeID = r.ReceiptTypeID
	                  LEFT JOIN cfg.Currency AS c
	                       ON  c.CurrencyID = rs.CurrencyID
	                  LEFT JOIN (
	                           SELECT ReceiveSubjectID,
	                                  SUM(Price) Amount
	                           FROM   sle.InvoicePreReceive
	                           GROUP BY
	                                  ReceiveSubjectID
	                       ) pre
	                       ON  pre.ReceiveSubjectID = rs.ReceiveSubjectID
	           WHERE  rs.Amount - ISNULL(pre.Amount, 0) > 0
	                  AND di.Type in( 1,11)
	           
	           UNION ALL
	           
	           SELECT di.PrevoucherID,
	                  di.ReceiptCheqeFlowItemID,
	                  pre.SLID,
	                  CASE 
	                       WHEN IsBaseCurrencyBasis = 0 THEN ROUND(pre.Amount * Rs.CurrencyRate / c.exchangeunit, @BaseDigit)
	                       WHEN IsBaseCurrencyBasis = 1 THEN ROUND(pre.Amount * c.exchangeunit / Rs.CurrencyRate, @BaseDigit)
	                  END AmountInBaseCurrency,
	                  rs.CurrencyID,
	                  rs.CurrencyRate,
	                  pre.Amount,
	                  0,
	                  0,
	                  ReceivableAccountsDescription DESCRIPTION,
	                  ReceivableAccountsDescription2 Description2,
					  rs.DLID,
					  rs.ReceiveSubjectID
	           FROM   #DocItems di
	                  INNER JOIN fin.ReceiveSubject rs
	                       ON  rs.ReceivedCheqeID = di.ReceivedCheqeID
	                  INNER JOIN fin.ReceiptType r
	                       ON  rs.ReceiptTypeID = r.ReceiptTypeID
	                  INNER JOIN cfg.Currency AS c
	                       ON  c.CurrencyID = rs.CurrencyID
	                  INNER JOIN (
	                           SELECT ReceiveSubjectID,
	                                  c.SlID,
	                                  SUM(Price) Amount
	                           FROM   sle.InvoicePreReceive a
	                                  JOIN sle.Invoice b
	                                       ON  a.InvoiceID = b.InvoiceID
	                                  JOIN sle.SaleType c
	                                       ON  c.SaleTypeID = b.SaleTypeID
	                           GROUP BY
	                                  ReceiveSubjectID,
	                                  c.SlID
	                       ) pre
	                       ON  pre.ReceiveSubjectID = rs.ReceiveSubjectID
	           WHERE  di.Type in( 1,11)
	       )T
	
	SELECT pt.SLID,
	       CASE 
	            WHEN IsBaseCurrencyBasis = 0 THEN ROUND(
	                     (ps.Amount - ps.Discount) * ps.CurrencyRate / c.exchangeunit,
	                     @BaseDigit
	                 )
	            WHEN IsBaseCurrencyBasis = 1 THEN ROUND(
	                     (ps.Amount - ps.Discount) * c.exchangeunit / ps.CurrencyRate,
	                     @BaseDigit
	                 )
	       END                              AmountInBaseCurrency,
	       ps.CurrencyID,
	       ps.CurrencyRate,
	       ps.Amount - ps.Discount          Amount,
	       rcfi.ReceiptCheqeFlowItemID,
	       rcfi.PrevoucherID,
	       REPLACE(REPLACE (REPLACE(@PayableAccountsDescription ,'@@CheckNumber@@',rc.Number),'@@CheckDueDate_Solar@@',dd.PersianFullDateAlternateKey),'@@CheckDueDate_AD@@',dd.FullDateAlternateKey)      DESCRIPTION,
	       REPLACE(REPLACE (REPLACE(@PayableAccountsDescription2 ,'@@CheckNumber@@',rc.Number),'@@CheckDueDate_Solar@@',dd.PersianFullDateAlternateKey),'@@CheckDueDate_AD@@',dd.FullDateAlternateKey)     Description2,
		   ps.DLID,
		   ps.PaymentSubjectID
	INTO   #PaymentSubject
	FROM   #DocItems rcfi
	       JOIN fin.ReceivedCheqe rc
	            ON  rc.ReceivedCheqeID = rcfi.ReceivedCheqeID
	        left join cfg.DimDate AS dd on rc.[Date] = dd.[Date]    
	       JOIN fin.PaymentOtherCheqe poc
	            ON  poc.ReceivedCheqeID = rc.ReceivedCheqeID
	            AND rcfi.PreviousFlow = poc.ReceiptCheqeFlowItemID
	       JOIN fin.PaymentSubject ps
	            ON  ps.PaymentOtherCheqeID = poc.PaymentOtherCheqeID
	       JOIN fin.PaymentType pt
	            ON  pt.PaymentTypeID = ps.PaymentTypeID
	       JOIN cfg.Currency c
	            ON  c.CurrencyID = ps.CurrencyID
	
	-- Insert Into PreVoucher Tabel
	SET IDENTITY_INSERT [ACC].[PreVoucher] ON	
	INSERT INTO [ACC].[PreVoucher](
	           [PreVoucherID],
	           BranchID,
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
	SELECT [PreVoucherID],
	       BranchId,
	       @DocumentNumTypeId,
	       DATE,
	       FinancialPeriodID,
	       DESCRIPTION,
	       Description2,
	       @CreatorId,
	       GETDATE(),
	       @CreatorId,
	       GETDATE(),
	       0
	FROM   #ReceiptCheqeFlow
	
	SET IDENTITY_INSERT [ACC].[PreVoucher] OFF
	
	UPDATE a
	SET    PreVoucherID = b.PreVoucherId
	FROM   FIN.ReceiptCheqeFlow a
	       JOIN #ReceiptCheqeFlow b
	            ON  a.ReceiptCheqeFlowID = b.ReceiptCheqeFlowID
          
	
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
	       slid,
	       DESCRIPTION,
	       Description2,
	       AmountInBaseCurrency,
	       0,
	       CurrencyID,
	       CurrencyRate,
	       Amount,
	       0,
	       1,
	       @CreatorId,
	       GETDATE(),
	       @CreatorId,
	       GETDATE(),
	       0,
	       'ReceiptCheqeFlowItem_ReceiveSubject',
	       ReceiveSubjectID
	FROM   #ReceiveSubject
	





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
	       CASE 
	            WHEN TYPE = 0 THEN @AssignToBankSlID
	            WHEN TYPE = 2 THEN di.AssingedBankSlID
	            WHEN TYPE = 3 THEN di.CashSlID
	            WHEN TYPE = 4 THEN slid
	            WHEN TYPE = 5 THEN CASE 
	                                    WHEN di.[STATE] = 6 THEN di.PreAssingedBankSlID
	                                    ELSE @ByProtestedDocumentSl
	                               END
	            WHEN TYPE = 10 THEN CASE 
	                                     WHEN di.PreState = 7 THEN @ByProtestedDocumentSl
	                                     ELSE di.SlID
	                                END
	       END,
	       CASE 
	            WHEN TYPE = 0 THEN  AssignToBankDocumentsDescription
	            WHEN TYPE = 2 THEN BankDescription
	            WHEN TYPE = 3 THEN CashDescription
	            WHEN TYPE = 4 THEN ReceivableDocumentsDescription
	            WHEN TYPE = 5 THEN CASE 
	                                    WHEN di.[STATE] = 6 THEN BankDescription
	                                    ELSE ByProtestedDocumentsDescription
	                               END
	            WHEN TYPE = 10 THEN CASE 
	                                     WHEN di.PreState = 7 THEN ByProtestedDocumentsDescription
	                                     ELSE ReceivableDocumentsDescription
	                                END
	       END,
	       CASE 
	            WHEN TYPE = 0 THEN  AssignToBankDocumentsDescription2
	            WHEN TYPE = 2 THEN BankDescription2
	            WHEN TYPE = 3 THEN CashDescription2
	            WHEN TYPE = 4 THEN ReceivableDocumentsDescription2
	            WHEN TYPE = 5 THEN CASE 
	                                    WHEN di.[STATE] = 6 THEN BankDescription2
	                                    ELSE ByProtestedDocumentsDescription2
	                               END
	            WHEN TYPE = 10 THEN CASE 
	                                     WHEN di.PreState = 7 THEN ByProtestedDocumentsDescription2
	                                     ELSE ReceivableDocumentsDescription2
	                                END
	       END,
	       di.AmountInBaseCurrency,
	       0,
	       di.CurrencyId,
	       di.CurrencyRate,
	       di.Amount,
	       0,
	       1,
	       @CreatorId,
	       GETDATE(),
	       @CreatorId,
	       GETDATE(),
	       0,
	       'ReceiptCheqeFlowItem',
	       ReceiptCheqeFlowItemID
	FROM   #DocItems                   di
	WHERE  TYPE not in ( 1,11)

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
	       CASE 
	            WHEN TYPE IN (0, 2, 3) THEN CASE 
	                                             WHEN di.PreState = 7 THEN @ByProtestedDocumentSl
	                                             ELSE di.SlID
	                                        END
	            WHEN TYPE in( 1,11) THEN CASE 
	                                    WHEN di.PreState = 7 THEN @ByProtestedDocumentSl
	                                    WHEN di.PreState IS NULL OR di.PreState <> 7 THEN di.SlID
	                               END
	            WHEN TYPE IN (5, 10) THEN @AssignToBankSlID
	       END,
	       CASE 
	            WHEN TYPE IN (0, 1,11, 2, 3) THEN CASE 
	                                                WHEN di.PreState = 7 THEN ByProtestedDocumentsDescription
	                                                ELSE ReceivableDocumentsDescription
	                                           END
	            WHEN TYPE IN (5, 10) THEN AssignToBankDocumentsDescription
	       END,
	       CASE 
	            WHEN TYPE IN (0, 1,11, 2, 3) THEN CASE 
	                                                WHEN di.PreState = 7 THEN ByProtestedDocumentsDescription2
	                                                ELSE ReceivableDocumentsDescription2
	                                           END
	            WHEN TYPE IN (5, 10) THEN AssignToBankDocumentsDescription2
	       END,
	       0,
	       di.AmountInBaseCurrency,
	       di.CurrencyId,
	       di.CurrencyRate,
	       0,
	       di.Amount,
	       1,
	       @CreatorId,
	       GETDATE(),
	       @CreatorId,
	       GETDATE(),
	       0,
	       'ReceiptCheqeFlowItem',
	       ReceiptCheqeFlowItemID
	FROM   #DocItems di
	WHERE  di.Type <> 4

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
	       CASE 
	            WHEN amount > 0 THEN 0
	            ELSE ABS(AmountInBaseCurrency)
	       END,
	       CASE 
	            WHEN amount > 0 THEN di.AmountInBaseCurrency
	            ELSE 0
	       END,
	       -1,
	       1,
	       CASE 
	            WHEN amount > 0 THEN 0
	            ELSE ABS(amount)
	       END,
	       CASE 
	            WHEN amount > 0 THEN di.amount
	            ELSE 0
	       END,
	       @CreatorId,
	       GETDATE(),
	       @CreatorId,
	       GETDATE(),
	       0,
	       'ReceiptCheqeFlowItem_PaymentSubject',
	       PaymentSubjectID
	FROM   #PaymentSubject di	
	
	INSERT INTO [ACC].[PreVoucherItemAccountLevel]
	       (
	           [PreVoucherItemID],
	           [AccountLevelID],
	           [DlID],
	           [Value],
	           [Creator],
	           [CreationDate],
	           [LastEditor],
	           [LastEditionDate],
	           [Version]
	       )
	SELECT pvi.PreVoucherItemID,
	       al.AccountLevelID,
	       dl.DLID,
	       NULL,
	       @CreatorId,
	       GETDATE(),
	       @CreatorId,
	       GETDATE(),
	       0
	FROM   #ReceiveSubject rs
	JOIN acc.PreVoucherItem pvi
	    ON  pvi.BaseDocumentName = 'ReceiptCheqeFlowItem_ReceiveSubject'
	    AND pvi.BaseDocumentID = rs.ReceiveSubjectID
		AND pvi.PreVoucherID = rs.PrevoucherID
		AND pvi.SlID = rs.SLID
	JOIN acc.AccountLevelSL al
	    ON  al.SlID = pvi.SlID
	JOIN acc.dl
	    ON  dl.DLID = rs.DLID
	    AND al.DlTypeID = dl.DlTypeID
	LEFT JOIN acc.PreVoucherItemAccountLevel alvi
	    ON  alvi.PreVoucherItemID = pvi.PreVoucherItemID
	    AND alvi.AccountLevelID = al.AccountLevelID
	WHERE  alvi.PreVoucherItemID IS NULL

	INSERT INTO [ACC].[PreVoucherItemAccountLevel]
	       (
	           [PreVoucherItemID],
	           [AccountLevelID],
	           [DlID],
	           [Value],
	           [Creator],
	           [CreationDate],
	           [LastEditor],
	           [LastEditionDate],
	           [Version]
	       )
	SELECT pvi.PreVoucherItemID,
	       al.AccountLevelID,
	       dl.DLID,
	       NULL,
	       @CreatorId,
	       GETDATE(),
	       @CreatorId,
	       GETDATE(),
	       0
	FROM   #PaymentSubject rs
	JOIN acc.PreVoucherItem pvi
	    ON  pvi.BaseDocumentName = 'ReceiptCheqeFlowItem_PaymentSubject'
	    AND pvi.BaseDocumentID = rs.PaymentSubjectID
		AND pvi.PreVoucherID = rs.PrevoucherID
		AND pvi.SlID = rs.SLID
	JOIN acc.AccountLevelSL al
	    ON  al.SlID = pvi.SlID
	JOIN acc.dl
	    ON  dl.DLID = rs.DLID
	    AND al.DlTypeID = dl.DlTypeID
	LEFT JOIN acc.PreVoucherItemAccountLevel alvi
	    ON  alvi.PreVoucherItemID = pvi.PreVoucherItemID
	    AND alvi.AccountLevelID = al.AccountLevelID
	WHERE  alvi.PreVoucherItemID IS NULL

	INSERT INTO [ACC].[PreVoucherItemAccountLevel]
	       (
	           [PreVoucherItemID],
	           [AccountLevelID],
	           [DlID],
	           [Value],
	           [Creator],
	           [CreationDate],
	           [LastEditor],
	           [LastEditionDate],
	           [Version]
	       )
	SELECT pvi.PreVoucherItemID,
	       al.AccountLevelID,
	       dl.DLID,
	       NULL,
	       @CreatorId,
	       GETDATE(),
	       @CreatorId,
	       GETDATE(),
	       0
	FROM   #DocItems rs
join #ReceiptCheqeFlow h on h.ReceiptCheqeFlowID = rs.ReceiptCheqeFlowID
JOIN acc.PreVoucherItem pvi
	ON  pvi.PreVoucherID = h.PrevoucherID
	and pvi.BaseDocumentName = 'ReceiptCheqeFlowItem'
	AND pvi.BaseDocumentID = ReceiptCheqeFlowItemID
	AND pvi.SlID = 	       CASE 
	        WHEN h.TYPE IN (0, 2, 3) THEN CASE 
	                                            WHEN rs.PreState = 7 THEN @ByProtestedDocumentSl
	                                            ELSE rs.SlID
	                                    END
	        WHEN h.TYPE in( 1,11) THEN CASE 
	                                WHEN rs.PreState = 7 THEN @ByProtestedDocumentSl
	                                WHEN rs.PreState IS NULL OR rs.PreState <> 7 THEN rs.SlID
	                            END
	        WHEN h.TYPE IN (5, 10) THEN @AssignToBankSlID
	    END
JOIN acc.AccountLevelSL al
	ON  al.SlID = pvi.SlID
JOIN acc.dl
	ON  dl.DLID = CASE 
	                    WHEN rs.Type = 4
	                    AND pvi.Credit > 0 THEN CheckReturner
	                    ELSE rs.partydlid
	                END
	AND al.DlTypeID = dl.DlTypeID
LEFT JOIN acc.PreVoucherItemAccountLevel alvi
	ON  alvi.PreVoucherItemID = pvi.PreVoucherItemID
	AND alvi.AccountLevelID = al.AccountLevelID
WHERE  alvi.PreVoucherItemID IS NULL

	INSERT INTO [ACC].[PreVoucherItemAccountLevel]
	       (
	           [PreVoucherItemID],
	           [AccountLevelID],
	           [DlID],
	           [Value],
	           [Creator],
	           [CreationDate],
	           [LastEditor],
	           [LastEditionDate],
	           [Version]
	       )
	SELECT pvi.PreVoucherItemID,
	       al.AccountLevelID,
	       dl.DLID,
	       NULL,
	       @CreatorId,
	       GETDATE(),
	       @CreatorId,
	       GETDATE(),
	       0
	FROM   #DocItems rs
join #ReceiptCheqeFlow h on h.ReceiptCheqeFlowID = rs.ReceiptCheqeFlowID
JOIN acc.PreVoucherItem pvi
	ON  pvi.PreVoucherID = h.PrevoucherID
	and pvi.BaseDocumentName = 'ReceiptCheqeFlowItem'
	AND pvi.BaseDocumentID = ReceiptCheqeFlowItemID
	AND pvi.SlID = 		       CASE 
	            WHEN h.TYPE = 0 THEN @AssignToBankSlID
	            WHEN h.TYPE = 2 THEN rs.AssingedBankSlID
	            WHEN h.TYPE = 3 THEN rs.CashSlID
	            WHEN h.TYPE = 4 THEN rs.slid
	            WHEN h.TYPE = 5 THEN CASE 
	                                    WHEN rs.[STATE] = 6 THEN rs.PreAssingedBankSlID
	                                    ELSE @ByProtestedDocumentSl
	                               END
	            WHEN h.TYPE = 10 THEN CASE 
	                                     WHEN rs.PreState = 7 THEN @ByProtestedDocumentSl
	                                     ELSE rs.SlID
	                                END
	       END
JOIN acc.AccountLevelSL al
	ON  al.SlID = pvi.SlID
JOIN acc.dl
	ON  dl.DLID = CASE 
	                    WHEN rs.Type = 4
	                    AND pvi.Credit > 0 THEN CheckReturner
	                    ELSE rs.partydlid
	                END
	AND al.DlTypeID = dl.DlTypeID
LEFT JOIN acc.PreVoucherItemAccountLevel alvi
	ON  alvi.PreVoucherItemID = pvi.PreVoucherItemID
	AND alvi.AccountLevelID = al.AccountLevelID
WHERE  alvi.PreVoucherItemID IS NULL
	
	INSERT INTO [ACC].[PreVoucherItemAccountLevel]
	       (
	           [PreVoucherItemID],
	           [AccountLevelID],
	           [DlID],
	           [Value],
	           [Creator],
	           [CreationDate],
	           [LastEditor],
	           [LastEditionDate],
	           [Version]
	       )
	SELECT pvi.PreVoucherItemID,
	       al.AccountLevelID,
	       rs.PreAssingedBankDlID,
	       NULL,
	       @CreatorId,
	       GETDATE(),
	       @CreatorId,
	       GETDATE(),
	       0
	FROM   #DocItems rs
	join #ReceiptCheqeFlow h on h.ReceiptCheqeFlowID = rs.ReceiptCheqeFlowID
	JOIN acc.PreVoucherItem pvi
	    ON  pvi.PreVoucherID = h.PrevoucherID
		and pvi.BaseDocumentName = 'ReceiptCheqeFlowItem'
	    AND pvi.BaseDocumentID = ReceiptCheqeFlowItemID
		AND pvi.SlID = 	       CASE 
	            WHEN h.TYPE = 0 THEN @AssignToBankSlID
	            WHEN h.TYPE = 2 THEN rs.AssingedBankSlID
	            WHEN h.TYPE = 3 THEN rs.CashSlID
	            WHEN h.TYPE = 4 THEN rs.slid
	            WHEN h.TYPE = 5 and pvi.Debit > 0  and rs.[STATE] = 6  THEN rs.PreAssingedBankSlID
				WHEN h.TYPE = 5 and pvi.Debit > 0  and rs.[STATE] = 7  THEN @ByProtestedDocumentSl
				WHEN h.TYPE = 5 and  pvi.Credit > 0 THEN @AssignToBankSlID
	            WHEN h.TYPE = 10 THEN CASE 
	                                     WHEN rs.PreState = 7 THEN @ByProtestedDocumentSl
	                                     ELSE rs.SlID
	                                END
	       END
	JOIN acc.AccountLevelSL al
	    ON  al.SlID = pvi.SlID
	JOIN acc.dl
	    ON  dl.DLID = PreAssingedBankDlID
	    AND al.DlTypeID = dl.DlTypeID
	LEFT JOIN acc.PreVoucherItemAccountLevel alvi
	    ON  alvi.PreVoucherItemID = pvi.PreVoucherItemID
	    AND alvi.AccountLevelID = al.AccountLevelID
	WHERE  alvi.PreVoucherItemID IS NULL	

	INSERT INTO [ACC].[PreVoucherItemAccountLevel]
	       (
	           [PreVoucherItemID],
	           [AccountLevelID],
	           [DlID],
	           [Value],
	           [Creator],
	           [CreationDate],
	           [LastEditor],
	           [LastEditionDate],
	           [Version]
	       )
	SELECT pvi.PreVoucherItemID,
	       al.AccountLevelID,
	       dl.DLID,
	       NULL,
	       @CreatorId,
	       GETDATE(),
	       @CreatorId,
	       GETDATE(),
	       0
	FROM   #DocItems rs
	join #ReceiptCheqeFlow h on h.ReceiptCheqeFlowID = rs.ReceiptCheqeFlowID
	JOIN acc.PreVoucherItem pvi
	    ON  pvi.PreVoucherID = h.PrevoucherID
		and pvi.BaseDocumentName = 'ReceiptCheqeFlowItem'
	    AND pvi.BaseDocumentID = ReceiptCheqeFlowItemID
		AND pvi.SlID = CASE 
	            WHEN h.TYPE = 0 THEN @AssignToBankSlID
	            WHEN h.TYPE = 2 THEN rs.AssingedBankSlID
	            WHEN h.TYPE = 3 THEN rs.CashSlID
	            WHEN h.TYPE = 4 THEN rs.slid
	            WHEN h.TYPE = 5 THEN CASE 
	                                    WHEN rs.[STATE] = 6 THEN rs.PreAssingedBankSlID
	                                    ELSE @ByProtestedDocumentSl
	                               END
	            WHEN h.TYPE = 10 THEN CASE 
	                                     WHEN rs.PreState = 7 THEN @ByProtestedDocumentSl
	                                     ELSE rs.SlID
	                                END
	       END
	       JOIN acc.AccountLevelSL al
	            ON  al.SlID = pvi.SlID
	       JOIN acc.dl
	            ON  dl.DLID = isnull(AssingedBankDlID,cashdlid)
	            AND al.DlTypeID = dl.DlTypeID
	       LEFT JOIN acc.PreVoucherItemAccountLevel alvi
	            ON  alvi.PreVoucherItemID = pvi.PreVoucherItemID
	            AND alvi.AccountLevelID = al.AccountLevelID
	WHERE  alvi.PreVoucherItemID IS NULL
	
	INSERT INTO [ACC].[PreVoucherItemAccountLevel]
	       (
	           [PreVoucherItemID],
	           [AccountLevelID],
	           [DlID],
	           [Value],
	           [Creator],
	           [CreationDate],
	           [LastEditor],
	           [LastEditionDate],
	           [Version]
	       )
	SELECT pvi.PreVoucherItemID,
	       al.AccountLevelID,
	       rs.CashDlID,
	       NULL,
	       @CreatorId,
	       GETDATE(),
	       @CreatorId,
	       GETDATE(),
	       0
	FROM   #DocItems rs
	JOIN acc.PreVoucherItem pvi
	    ON  pvi.BaseDocumentName = 'ReceiptCheqeFlowItem'
	    AND pvi.BaseDocumentID = ReceiptCheqeFlowItemID
		AND pvi.SlID = rs.SLID
	JOIN acc.AccountLevelSL al
	    ON  al.SlID = pvi.SlID
	JOIN acc.dl
	    ON  dl.DLID = CashDlID
	    AND al.DlTypeID = dl.DlTypeID
	LEFT JOIN acc.PreVoucherItemAccountLevel alvi
	    ON  alvi.PreVoucherItemID = pvi.PreVoucherItemID
	    AND alvi.AccountLevelID = al.AccountLevelID
	WHERE  alvi.PreVoucherItemID IS NULL
	
	;WITH temp AS 
	(
	    SELECT [pi].PreVoucherItemID,
	           ROW_NUMBER() OVER(PARTITION BY PI.PreVoucherID ORDER BY PreVoucherItemID) RowIndex,
	           REPLACE(
			   REPLACE(
	           REPLACE(
	           REPLACE([pi].Description, 
					   '@@Number@@', i.Number),
	                   '@@Date_Gregorian@@',FullDateAlternateKey),
					   '@@Date_Solar@@',PersianFullDateAlternateKey),
					   '@@OperationType@@',(
											CASE
												WHEN i.[Type] = 0  THEN @AssignToBankOperation
												WHEN i.[Type] in( 1,11)  THEN @DrawBackOperation
												WHEN i.[Type] = 2  THEN @CashToBankOperation
												WHEN i.[Type] = 3  THEN @CashToFundOperation
												WHEN i.[Type] = 4  THEN @ReturnedOfSpendOperation
												WHEN i.[Type] = 5  THEN @CashAndProtestOperation
												WHEN i.[Type] = 7  THEN @InitialAssignToBankOperation
												WHEN i.[Type] = 8  THEN @InitialProtestOperation
												WHEN i.[Type] = 10 THEN @ReturnFromAssignmentOperation
											END)) [Description],
	           REPLACE(
			   REPLACE(
			   REPLACE(
		       REPLACE([pi].Description2, 
						'@@Number@@', i.Number),
					    '@@Date_Gregorian@@',FullDateAlternateKey),
					    '@@Date_Solar@@',PersianFullDateAlternateKey),
						'@@OperationType@@',(
											CASE
												WHEN i.[Type] = 0  THEN @AssignToBankOperation
												WHEN i.[Type] in( 1,11)  THEN @DrawBackOperation
												WHEN i.[Type] = 2  THEN @CashToBankOperation
												WHEN i.[Type] = 3  THEN @CashToFundOperation
												WHEN i.[Type] = 4  THEN @ReturnedOfSpendOperation
												WHEN i.[Type] = 5  THEN @CashAndProtestOperation
												WHEN i.[Type] = 7  THEN @InitialAssignToBankOperation
												WHEN i.[Type] = 8  THEN @InitialProtestOperation
												WHEN i.[Type] = 10 THEN @ReturnFromAssignmentOperation
											END))[Description2]
	    FROM   #ReceiptCheqeFlow i
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
	
	UPDATE PI
	SET   Description = 
	           REPLACE(
			   REPLACE(
	           REPLACE(
	           REPLACE([pi].Description, 
					   '@@Number@@', i.Number),
	                   '@@Date_Gregorian@@',FullDateAlternateKey),
					   '@@Date_Solar@@',PersianFullDateAlternateKey),
					   '@@OperationType@@',(
											CASE
												WHEN i.[Type] = 0  THEN @AssignToBankOperation
												WHEN i.[Type] IN( 1,11)  THEN @DrawBackOperation
												WHEN i.[Type] = 2  THEN @CashToBankOperation
												WHEN i.[Type] = 3  THEN @CashToFundOperation
												WHEN i.[Type] = 4  THEN @ReturnedOfSpendOperation
												WHEN i.[Type] = 5  THEN @CashAndProtestOperation
												WHEN i.[Type] = 7  THEN @InitialAssignToBankOperation
												WHEN i.[Type] = 8  THEN @InitialProtestOperation
												WHEN i.[Type] = 10 THEN @ReturnFromAssignmentOperation
											END)) ,
			Description2 =
	           REPLACE(
			   REPLACE(
			   REPLACE(
		       REPLACE([pi].Description2, 
						'@@Number@@', i.Number),
					    '@@Date_Gregorian@@',FullDateAlternateKey),
					    '@@Date_Solar@@',PersianFullDateAlternateKey),
						'@@OperationType@@',(
											CASE
												WHEN i.[Type] = 0  THEN @AssignToBankOperation
												WHEN i.[Type] IN( 1,11)  THEN @DrawBackOperation
												WHEN i.[Type] = 2  THEN @CashToBankOperation
												WHEN i.[Type] = 3  THEN @CashToFundOperation
												WHEN i.[Type] = 4  THEN @ReturnedOfSpendOperation
												WHEN i.[Type] = 5  THEN @CashAndProtestOperation
												WHEN i.[Type] = 7  THEN @InitialAssignToBankOperation
												WHEN i.[Type] = 8  THEN @InitialProtestOperation
												WHEN i.[Type] = 10 THEN @ReturnFromAssignmentOperation
											END))
	FROM   acc.PreVoucher PI
	       JOIN #ReceiptCheqeFlow i
	            ON  PI.PrevoucherID = i.PrevoucherID
