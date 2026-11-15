
--==============================================Alter SpGuarantyOperationUpdate
CREATE   PROC [FIN].[SpGuarantyOperationUpdate] 
    @GuarantyOperationID INT,
    @BranchID INT,
    @CommitmentType TINYINT,
    @Number INT,
    @date DATE,
    @PaymentGuarantyCommitmentID INT = NULL,
    @ReceiveGuarantyCommitmentID INT = NULL,
    @OperationType TINYINT,
    @DueDate DATE = NULL,
    @DeductedAmount DECIMAL(30, 4),
    @BankAccountID INT = NULL,
    @DraftNumber NVARCHAR(50) = NULL,
	@SlID INT = NULL,
	@CurrencyRate DECIMAL(20, 10) = NULL,
    @Description NVARCHAR(250) = NULL,
    @Description2 NVARCHAR(250) = NULL,
    @PreVoucherID INT = NULL,
    @FinancialPeriodID INT,
    @Version INT,
    @LastEditor INT,
    @LastEditionDate DATETIME
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON 

	IF @Version <> (SELECT [Version] FROM [FIN].[GuarantyOperation]
					WHERE [GuarantyOperationID] = @GuarantyOperationID)
	BEGIN
	RAISERROR('Version mismatch...', 16 , 10)
	RETURN
	END
	
	DECLARE 
		@FinalID INT = NULL,
		@FinalDate DATE = NULL,
		@FinalDateString NVARCHAR(100) = NULL,
		@GuarantyAmount DECIMAL(30, 4),
		@SumDeductedAmount DECIMAL(30, 4),
		@FinalDeductedAmount DECIMAL(30, 4),
		@Message NVARCHAR(MAX) = NULL,
		@PreCommitmentType TINYINT,
		@PreOperationType TINYINT,
		@PreReceiveGuarantyCommitmentID INT = NULL,
		@PrePaymentGuarantyCommitmentID INT = NULL,
		@Predate DATE,
		@PreBankAccountID INT = NULL,
		@LastAmount DECIMAL(30, 4),
		@DlTitle NVARCHAR(256) = NULL,
		@MaxDate DATE = NULL,
		@Title NVARCHAR(256) = NULL,
		@s NVARCHAR(MAX)
    
	SELECT 
		@PreCommitmentType = g.CommitmentType,
	    @PreOperationType = g.OperationType,
	    @PreReceiveGuarantyCommitmentID = g.ReceiveGuarantyCommitmentID,
	    @PrePaymentGuarantyCommitmentID = g.PaymentGuarantyCommitmentID,
	    @PreBankAccountID = g.BankAccountID,
	    @Predate = g.[date]
	FROM 
		FIN.GuarantyOperation g
	WHERE 
		g.GuarantyOperationID = @GuarantyOperationID
	
	IF (@PreOperationType <> 4 AND @OperationType = 4)
	BEGIN
		SELECT 
			@MaxDate = MAX(r.[Date]) 
		FROM 
			FIN.Reconciliation r 
		WHERE 
			r.BankAccountID = @BankAccountID  
		
		IF (@date <= @MaxDate)
		BEGIN
			SELECT  @Title = d.Title 
			FROM  CFG.BankAccount b
			JOIN  ACC.DL d 
				ON  b.DlID = d.DLID
			WHERE 
				b.BankAccountID = @BankAccountID
			
			RAISERROR('به ازای حساب بانکی (%s) به تاریخ بزرگتر یا مساوی تاریخ انتخاب شده مغایرت انجام شده است.لذا هیچ عملیاتی برای این حساب بانکی قابل انجام نیست.',16,12,@Title) 
			RETURN
		END
	END
	
	ELSE IF (@PreOperationType = 4 AND @OperationType <> 4)
	BEGIN
		SELECT 
			@MaxDate = MAX(r.[Date]) 
		FROM 
			FIN.Reconciliation r 
		WHERE 
			r.BankAccountID = @PreBankAccountID  
		
		IF (@date <= @MaxDate)
		BEGIN
			SELECT 
				@Title = d.Title 
			FROM 
				CFG.BankAccount b
			JOIN 
				ACC.DL d 
			ON 
				b.DlID = d.DLID
			WHERE 
				b.BankAccountID = @PreBankAccountID
			
			RAISERROR('به ازای حساب بانکی (%s) به تاریخ بزرگتر یا مساوی تاریخ انتخاب شده مغایرت انجام شده است.لذا هیچ عملیاتی برای این حساب بانکی قابل انجام نیست.',16,12,@Title) 
			RETURN
		END
	END
	
	ELSE IF (@PreOperationType = 4 AND @OperationType = 4)
	BEGIN
		IF (@PreBankAccountID <> @BankAccountID)
		BEGIN
			SELECT 
				@MaxDate = MAX(r.[Date]) 
			FROM 
				FIN.Reconciliation r 
			WHERE 
				r.BankAccountID = @PreBankAccountID  
		
			IF (@date <= @MaxDate)
			BEGIN
				SELECT 
					@Title = d.Title 
				FROM 
					CFG.BankAccount b
				JOIN 
					ACC.DL d 
				ON 
					b.DlID = d.DLID
				WHERE 
					b.BankAccountID = @PreBankAccountID
				
				RAISERROR('به ازای حساب بانکی (%s) به تاریخ بزرگتر یا مساوی تاریخ انتخاب شده مغایرت انجام شده است.لذا هیچ عملیاتی برای این حساب بانکی قابل انجام نیست.',16,12,@Title) 
				RETURN
			END
			
			SELECT 
				@MaxDate = MAX(r.[Date]) 
			FROM 
				FIN.Reconciliation r 
			WHERE 
				r.BankAccountID = @BankAccountID  
		
			IF (@date <= @MaxDate)
			BEGIN
				SELECT 
					@Title = d.Title 
				FROM 
					CFG.BankAccount b
				JOIN 
					ACC.DL d 
				ON 
					b.DlID = d.DLID
				WHERE 
					b.BankAccountID = @BankAccountID
				
				RAISERROR('به ازای حساب بانکی (%s) به تاریخ بزرگتر یا مساوی تاریخ انتخاب شده مغایرت انجام شده است.لذا هیچ عملیاتی برای این حساب بانکی قابل انجام نیست.',16,12,@Title) 
				RETURN
			END
		END
		
		ELSE IF 
			((@PreCommitmentType <> @CommitmentType) OR 
		    (@PreCommitmentType = @CommitmentType AND @CommitmentType = 1 AND @PreReceiveGuarantyCommitmentID <> @ReceiveGuarantyCommitmentID) OR
		    (@PreCommitmentType = @CommitmentType AND @CommitmentType = 2 AND @PrePaymentGuarantyCommitmentID <> @PaymentGuarantyCommitmentID) OR
		    (@Predate <> @date))
		BEGIN
			SELECT 
				@MaxDate = MAX(r.[Date]) 
			FROM 
				FIN.Reconciliation r 
			WHERE r.BankAccountID = @BankAccountID  
		
			IF (@date <= @MaxDate)
			BEGIN
				SELECT 
					@Title = d.Title 
				FROM 
					CFG.BankAccount b
				JOIN 
					ACC.DL d 
				ON 
					b.DlID = d.DLID
				WHERE 
					b.BankAccountID = @BankAccountID
				
				RAISERROR('به ازای حساب بانکی (%s) به تاریخ بزرگتر یا مساوی تاریخ انتخاب شده مغایرت انجام شده است.لذا هیچ عملیاتی برای این حساب بانکی قابل انجام نیست.',16,12,@Title) 
				RETURN
			END
		END
	END
	
	IF (@OperationType = 1)
    BEGIN
		IF (@CommitmentType = 1)
		BEGIN
			SELECT 
				@FinalID = T.GuarantyOperationID,
			    @FinalDate = T.DueDate
			FROM 
			(
				SELECT 
					ROW_NUMBER() OVER(PARTITION BY ReceiveGuarantyCommitmentID ORDER BY GuarantyOperationID DESC) 
					RowNumber,
					*
				FROM 
					FIN.GuarantyOperation g
				WHERE 
					g.CommitmentType = 1 AND
					g.ReceiveGuarantyCommitmentID = @ReceiveGuarantyCommitmentID AND
					g.OperationType = 1 AND
					g.GuarantyOperationID <> @GuarantyOperationID
			) AS T
			WHERE 
				T.RowNumber = 1
			
			IF (@FinalID IS NOT NULL)
			BEGIN
				SET 
					@FinalDateString = CFG.GetSaturnDate(@FinalDate,0)
			
				IF (@DueDate <= @FinalDate)
				BEGIN
					RAISERROR('تاریخ سررسید نهایی ضمانت نامه (%s) است. تاریخ وارد شده باید بزرگتر از سررسید نهایی ضمانت نامه باشد.',16,12,@FinalDateString)
					RETURN
				END
			END
			ELSE
			BEGIN
				SELECT 
					@FinalDate = r.[Date] 
				FROM 
					FIN.ReceiveGuarantyCommitment r 
				WHERE 
					r.ReceiveGuarantyCommitmentID = @ReceiveGuarantyCommitmentID
				
				SET 
					@FinalDateString = CFG.GetSaturnDate(@FinalDate,0)
				
				IF (@DueDate <= @FinalDate)
				BEGIN
					RAISERROR('تاریخ سررسید نهایی ضمانت نامه (%s) است. تاریخ وارد شده باید بزرگتر از سررسید نهایی ضمانت نامه باشد.',16,12,@FinalDateString)
					RETURN
				END
			END
		END
		
		IF (@CommitmentType = 2)
		BEGIN
			SELECT 
				@FinalID = T.GuarantyOperationID,
			    @FinalDate = T.DueDate
			FROM 
			(
				SELECT 
					ROW_NUMBER() OVER(PARTITION BY PaymentGuarantyCommitmentID ORDER BY GuarantyOperationID DESC) 
					RowNumber,
					*
				FROM 
					FIN.GuarantyOperation g
				WHERE 
					g.CommitmentType = 2 AND
				    g.PaymentGuarantyCommitmentID = @PaymentGuarantyCommitmentID AND
				    g.OperationType = 1 AND 
				    g.GuarantyOperationID <> @GuarantyOperationID
			) AS T
			WHERE 
				T.RowNumber = 1
			
			IF (@FinalID IS NOT NULL)
			BEGIN
				SET 
					@FinalDateString = CFG.GetSaturnDate(@FinalDate,0)
				
				IF (@DueDate <= @FinalDate)
				BEGIN
					RAISERROR('تاریخ سررسید نهایی ضمانت نامه (%s) است. تاریخ وارد شده باید بزرگتر از سررسید نهایی ضمانت نامه باشد.',16,12,@FinalDateString)
					RETURN
				END
			END
			ELSE
			BEGIN
				SELECT 
					@FinalDate = p.[Date] 
				FROM 
					FIN.PaymentGuarantyCommitment p
				WHERE 
					p.PaymentGuarantyCommitmentID = @PaymentGuarantyCommitmentID
				
				SET 
					@FinalDateString = CFG.GetSaturnDate(@FinalDate, 0)
				
				IF (@DueDate <= @FinalDate)
				BEGIN
					RAISERROR('تاریخ سررسید نهایی ضمانت نامه (%s) است. تاریخ وارد شده باید بزرگتر از سررسید نهایی ضمانت نامه باشد.',16,12,@FinalDateString)
					RETURN
				END
			END
		END
	END
	
	IF (@OperationType = 2)
    BEGIN
  
		IF (@CommitmentType = 1)
		BEGIN
			SELECT 
				@GuarantyAmount = r.Amount 
			FROM 
				FIN.ReceiveGuarantyCommitment r 
			WHERE 
				r.ReceiveGuarantyCommitmentID = @ReceiveGuarantyCommitmentID
	
			SELECT 
				@SumDeductedAmount = SUM(CASE WHEN OperationType = 2 THEN -g.DeductedAmount 
										 WHEN OperationType = 5 THEN g.DeductedAmount END)
			FROM 
				FIN.GuarantyOperation g
		    WHERE 
				g.CommitmentType = 1 AND 
				g.ReceiveGuarantyCommitmentID = @ReceiveGuarantyCommitmentID AND 
				g.OperationType IN (2, 5) AND 
				g.GuarantyOperationID <> @GuarantyOperationID
		    
		    SET 
				@FinalDeductedAmount = @GuarantyAmount + ISNULL(@SumDeductedAmount, 0) 
			
			IF (@DeductedAmount >= @FinalDeductedAmount)
			BEGIN
				SET 
					@s = 'مبلغ نهایی ضمانت نامه ' + CAST(@FinalDeductedAmount AS VARCHAR(100)) + ' است. مبلغ کسر شده باید کوچکتر از مبلغ نهایی ضمانت نامه باشد.'
				RAISERROR(@s, 16, 12)
				RETURN
			END
		END
		
		IF (@CommitmentType = 2)
		BEGIN
			SELECT 
				@GuarantyAmount = p.Amount 
			FROM 
				FIN.PaymentGuarantyCommitment p
			WHERE 
				p.PaymentGuarantyCommitmentID = @PaymentGuarantyCommitmentID

			SELECT 
				@SumDeductedAmount = SUM(CASE WHEN OperationType = 2 THEN -g.DeductedAmount 
										 WHEN OperationType = 5 THEN g.DeductedAmount END)
			FROM FIN.GuarantyOperation g
		    WHERE 
				g.CommitmentType = 2 AND 
				g.PaymentGuarantyCommitmentID = @PaymentGuarantyCommitmentID AND 
				g.OperationType IN (2, 5) AND 
				g.GuarantyOperationID <> @GuarantyOperationID

		    SET 
				@FinalDeductedAmount = @GuarantyAmount + ISNULL(@SumDeductedAmount, 0)
			
			IF (@DeductedAmount >= @FinalDeductedAmount)
			BEGIN
				SET 
					@s = 'مبلغ نهایی ضمانت نامه ' + CAST(@FinalDeductedAmount AS VARCHAR(100)) + ' است. مبلغ کسر شده باید کوچکتر از مبلغ نهایی ضمانت نامه باشد.'
				RAISERROR(@s, 16, 12)
				RETURN
			END
		END
	END
	
	SET 
		@Version = @Version + 1
	
	DECLARE 
		@CompanyID INT

	SELECT 
		@CompanyID = b.CompanyID 
	FROM 
		CFG.Branch b 
	WHERE 
		b.BranchID = @BranchID
	
	IF(@Number = 0 OR @Number IS NULL)
	SET 
		@Number = ISNULL(
						(SELECT 
							MAX(Number) + 1
							FROM 
								[FIN].[GuarantyOperation] GuarantyOperation
							JOIN 
								CFG.Branch b 
							ON 
								GuarantyOperation.BranchID = b.BranchID
							WHERE 
								GuarantyOperation.FinancialPeriodID = @FinancialPeriodID AND 
								b.CompanyID = @CompanyID)
						, 1) 

	UPDATE 
		[FIN].[GuarantyOperation]
	SET    
		[BranchID] = @BranchID, 
		[CommitmentType] = @CommitmentType, 
		[Number] = @Number, 
		[date] = @date, 
		[PaymentGuarantyCommitmentID] = @PaymentGuarantyCommitmentID, 
		[ReceiveGuarantyCommitmentID] = @ReceiveGuarantyCommitmentID, 
		[OperationType] = @OperationType, 
		[DueDate] = @DueDate, 
		[DeductedAmount] = @DeductedAmount, 
		[BankAccountID] = @BankAccountID, 
		[DraftNumber] = @DraftNumber, 
		[SlID] = @SlID,
		[CurrencyRate] = @CurrencyRate,
		[Description] = @Description, 
		[Description2] = @Description2, 
		[PreVoucherID] = @PreVoucherID, 
		[Version] = @Version, 
		[LastEditor] = @LastEditor, 
		[LastEditionDate] = @LastEditionDate
	WHERE  
		[GuarantyOperationID] = @GuarantyOperationID
	
	-- Begin Return Select <- do not remove
	SELECT 
		[Version], 
		[Number]
	FROM   
		[FIN].[GuarantyOperation]
	WHERE  
		[GuarantyOperationID] = @GuarantyOperationID	
	-- End Return Select <- do not remove
    
	IF (@PreOperationType = 3 AND @OperationType <> 3)
	BEGIN
		IF (@PreCommitmentType = 1)
		BEGIN
			UPDATE 
				FIN.ReceiveGuarantyCommitment 
			SET 
				LastState = 1
			WHERE 
				ReceiveGuarantyCommitmentID = @PreReceiveGuarantyCommitmentID
		END
		
		IF (@PreCommitmentType = 2)
		BEGIN
			UPDATE 
				FIN.PaymentGuarantyCommitment 
			SET 
				LastState = 1
			WHERE 
				PaymentGuarantyCommitmentID = @PrePaymentGuarantyCommitmentID
		END
	END
	
	IF (@PreOperationType <> 3 AND @OperationType = 3)
	BEGIN
		IF (@CommitmentType = 1)
		BEGIN
			UPDATE 
				FIN.ReceiveGuarantyCommitment 
			SET 
				LastState = 2
			WHERE 
				ReceiveGuarantyCommitmentID = @ReceiveGuarantyCommitmentID
		END
		
		IF (@CommitmentType = 2)
		BEGIN
			UPDATE 
				FIN.PaymentGuarantyCommitment 
			SET 
				LastState = 2
			WHERE 
				PaymentGuarantyCommitmentID = @PaymentGuarantyCommitmentID
		END
	END
	
	IF (@PreOperationType = 3 AND @OperationType = 3)
	BEGIN
		IF (@PreCommitmentType = 1 AND @CommitmentType = 2)
		BEGIN
			UPDATE 
				FIN.ReceiveGuarantyCommitment 
			SET 
				LastState = 1
			WHERE 
				ReceiveGuarantyCommitmentID = @PreReceiveGuarantyCommitmentID
			
			UPDATE 
				FIN.PaymentGuarantyCommitment 
			SET 
				LastState = 2
			WHERE 
				PaymentGuarantyCommitmentID = @PaymentGuarantyCommitmentID
		END
		
		IF (@PreCommitmentType = 2 AND @CommitmentType = 1)
		BEGIN
			UPDATE 
				FIN.PaymentGuarantyCommitment 
			SET 
				LastState = 1
			WHERE 
				PaymentGuarantyCommitmentID = @PrePaymentGuarantyCommitmentID
		
			UPDATE 
				FIN.ReceiveGuarantyCommitment 
			SET 
				LastState = 2
			WHERE 
				ReceiveGuarantyCommitmentID = @ReceiveGuarantyCommitmentID
		END
		
		IF (@PreCommitmentType = 1 AND @CommitmentType = 1)
		BEGIN
			IF (@PreReceiveGuarantyCommitmentID <> @ReceiveGuarantyCommitmentID)
			BEGIN
				UPDATE 
					FIN.ReceiveGuarantyCommitment 
				SET 
					LastState = 1
				WHERE 
					ReceiveGuarantyCommitmentID = @PreReceiveGuarantyCommitmentID
				
				UPDATE 
					FIN.ReceiveGuarantyCommitment 
				SET 
					LastState = 2
				WHERE 
					ReceiveGuarantyCommitmentID = @ReceiveGuarantyCommitmentID
			END
		END
		
		IF (@PreCommitmentType = 2 AND @CommitmentType = 2)
		BEGIN
			IF (@PrePaymentGuarantyCommitmentID <> @PaymentGuarantyCommitmentID)
			BEGIN
				UPDATE 
					FIN.PaymentGuarantyCommitment 
				SET 
					LastState = 1
				WHERE 
					PaymentGuarantyCommitmentID = @PrePaymentGuarantyCommitmentID
				
				UPDATE 
					FIN.PaymentGuarantyCommitment 
				SET 
					LastState = 2
				WHERE 
					PaymentGuarantyCommitmentID = @PaymentGuarantyCommitmentID
			END
		END
	END
	
	IF (@PreOperationType = 4 AND @OperationType <> 4)
	BEGIN
		IF (@PreCommitmentType = 1)
		BEGIN
			UPDATE 
				FIN.ReceiveGuarantyCommitment 
			SET 
				LastState = 1
			WHERE 
				ReceiveGuarantyCommitmentID = @PreReceiveGuarantyCommitmentID
			
			SELECT 
				@GuarantyAmount = r.Amount
			FROM 
				FIN.ReceiveGuarantyCommitment r 
			WHERE 
				r.ReceiveGuarantyCommitmentID = @PreReceiveGuarantyCommitmentID
			
			SELECT 
				@SumDeductedAmount = ISNULL((SELECT SUM(g.DeductedAmount) 
			FROM 
				FIN.GuarantyOperation g 
			WHERE 
				g.CommitmentType = 1 AND 
				g.ReceiveGuarantyCommitmentID = @PreReceiveGuarantyCommitmentID AND
				g.OperationType = 2 AND
				g.GuarantyOperationID <> @GuarantyOperationID),0)
			
			SET 
				@FinalDeductedAmount = @GuarantyAmount - @SumDeductedAmount
			
			IF LOWER((SELECT f.ConfigValue FROM CFG.Configuration f
					  WHERE f.ConfigKey = 'BankAccountNegativeStoreControl')) = 'true'
			BEGIN
				SELECT 
					@LastAmount = la.LastAmount,
					@DlTitle = d.Title 
				FROM 
					CFG.BankAccount ba
				JOIN 
					ACC.DL d 
				ON 
					ba.DlID = d.DLID
				JOIN 
					cfg.BankAccount_LastAmount la 
				ON 
					ba.BankAccountID = la.BankAccountID
				WHERE 
					ba.BankAccountID = @PreBankAccountID
				
				IF (@LastAmount < 0)
				BEGIN
					SELECT 
						@Message = lsv.[Value]
					FROM 
						cfg.LocalizationSQLMessage ls
					JOIN 
						cfg.LocalizationSQLMessageValue lsv 
					ON 
						lsv.LocalizationSQLMessageID = ls.LocalizationSQLMessageID
					WHERE 
						ls.SQLMessageCode = 'MinusBankAccount' AND 
						lsv.Culture = cfg.GetuserCulture()
					
					SET 
						@Message = REPLACE(@Message, '{0}', @DlTitle)

					RAISERROR(@Message, 16, 12)
					RETURN
					--RAISERROR('موجودی حساب بانکی (%s) منفی خواهد شد.',16,12,@DlTitle)
				END
			END
		END
		
		IF (@PreCommitmentType = 2)
		BEGIN
			UPDATE 
				FIN.PaymentGuarantyCommitment 
			SET 
				LastState = 1
			WHERE 
				PaymentGuarantyCommitmentID = @PrePaymentGuarantyCommitmentID
			
			SELECT 
				@GuarantyAmount =  p.Amount
			FROM 
				FIN.PaymentGuarantyCommitment p 
			WHERE 
				p.PaymentGuarantyCommitmentID = @PrePaymentGuarantyCommitmentID
			
			SELECT 
				@SumDeductedAmount = ISNULL((SELECT SUM(g.DeductedAmount)
			FROM 
				FIN.GuarantyOperation g
			WHERE 
				g.CommitmentType = 2 AND 
				g.PaymentGuarantyCommitmentID = @PrePaymentGuarantyCommitmentID AND
				g.OperationType = 2 AND
				g.GuarantyOperationID <> @GuarantyOperationID),0)
			
			SET 
				@FinalDeductedAmount = @GuarantyAmount - @SumDeductedAmount
		END
	END
	
	IF (@PreOperationType <> 4 AND @OperationType = 4)
	BEGIN
		IF (@CommitmentType = 1)
		BEGIN
			UPDATE 
				FIN.ReceiveGuarantyCommitment 
			SET 
				LastState = 3
			WHERE 
				ReceiveGuarantyCommitmentID = @ReceiveGuarantyCommitmentID
			
			SELECT 
				@GuarantyAmount = r.Amount
			FROM 
				FIN.ReceiveGuarantyCommitment r 
			WHERE 
				r.ReceiveGuarantyCommitmentID = @ReceiveGuarantyCommitmentID
			
			SELECT 
				@SumDeductedAmount = ISNULL((SELECT SUM(g.DeductedAmount) 
			FROM 
				FIN.GuarantyOperation g 
			WHERE 
				g.CommitmentType = 1 AND 
				g.ReceiveGuarantyCommitmentID = @ReceiveGuarantyCommitmentID AND
				g.OperationType = 2), 0)
			
			SET 
				@FinalDeductedAmount = @GuarantyAmount - @SumDeductedAmount
		END
		
		IF (@CommitmentType = 2)
		BEGIN
			UPDATE 
				FIN.PaymentGuarantyCommitment 
			SET 
				LastState = 3
			WHERE 
				PaymentGuarantyCommitmentID = @PaymentGuarantyCommitmentID
			
			SELECT 
				@GuarantyAmount =  p.Amount
			FROM 
				FIN.PaymentGuarantyCommitment p 
			WHERE 
				p.PaymentGuarantyCommitmentID = @PaymentGuarantyCommitmentID
			
			SELECT 
				@SumDeductedAmount = ISNULL((SELECT SUM(g.DeductedAmount)
			FROM 
				FIN.GuarantyOperation g
			WHERE 
				g.CommitmentType = 2 AND
				g.PaymentGuarantyCommitmentID = @PaymentGuarantyCommitmentID AND
				g.OperationType = 2),0)
			
			SET 
				@FinalDeductedAmount = @GuarantyAmount - @SumDeductedAmount
			
			IF LOWER((SELECT f.ConfigValue FROM CFG.Configuration f
					  WHERE f.ConfigKey = 'BankAccountNegativeStoreControl')) = 'true'
			BEGIN
				SELECT 
					@LastAmount = la.LastAmount,
					@DlTitle = d.Title 
				FROM 
					CFG.BankAccount ba
				JOIN 
					ACC.DL d 
				ON 
					ba.DlID = d.DLID
				JOIN 
					CFG.BankAccount_LastAmount la 
				ON 
					ba.BankAccountID = la.BankAccountID
				WHERE
					ba.BankAccountID = @BankAccountID
				
				IF (@LastAmount < 0)
				BEGIN
					SELECT 
						@Message = lsv.[Value]
					FROM 
						cfg.LocalizationSQLMessage ls
					JOIN 
						cfg.LocalizationSQLMessageValue lsv 
					ON 
						lsv.LocalizationSQLMessageID = ls.LocalizationSQLMessageID
					WHERE 
						ls.SQLMessageCode = 'MinusBankAccount' AND 
						lsv.Culture = cfg.GetuserCulture()
					
					SET 
						@Message = REPLACE(@Message, '{0}', @DlTitle)

					RAISERROR(@Message, 16, 12)
					RETURN
					--RAISERROR('موجودی حساب بانکی (%s) منفی خواهد شد.',16,12,@DlTitle)
				END
			END
		END
	END
	
	IF (@PreOperationType = 4 AND @OperationType = 4)
	BEGIN
		IF (@PreCommitmentType = 1 AND @CommitmentType = 2)
		BEGIN
			UPDATE 
				FIN.ReceiveGuarantyCommitment 
			SET 
				LastState = 1
			WHERE 
				ReceiveGuarantyCommitmentID = @PreReceiveGuarantyCommitmentID
			
			SELECT 
				@GuarantyAmount = r.Amount
			FROM 
				FIN.ReceiveGuarantyCommitment r 
			WHERE 
				r.ReceiveGuarantyCommitmentID = @PreReceiveGuarantyCommitmentID
			
			SELECT 
				@SumDeductedAmount = ISNULL((SELECT SUM(g.DeductedAmount) 
			FROM 
				FIN.GuarantyOperation g 
			WHERE 
				g.CommitmentType = 1 AND 
				g.ReceiveGuarantyCommitmentID = @PreReceiveGuarantyCommitmentID AND
				g.OperationType = 2), 0)
			
			SET 
				@FinalDeductedAmount = @GuarantyAmount - @SumDeductedAmount
			
			IF LOWER((SELECT f.ConfigValue FROM CFG.Configuration f
					  WHERE f.ConfigKey = 'BankAccountNegativeStoreControl')) = 'true'
			BEGIN
				SELECT 
					@LastAmount = la.LastAmount,
					@DlTitle = d.Title 
				FROM 
					CFG.BankAccount ba
				JOIN 
					ACC.DL d 
				ON 
					ba.DlID = d.DLID
				JOIN 
					cfg.BankAccount_LastAmount la 
				ON 
					ba.BankAccountID = la.BankAccountID
				WHERE 
					ba.BankAccountID = @PreBankAccountID
				
				IF (@LastAmount < 0)
				BEGIN
					SELECT 
						@Message = lsv.[Value]
					FROM 
						cfg.LocalizationSQLMessage ls
					JOIN 
						cfg.LocalizationSQLMessageValue lsv 
					ON 
						lsv.LocalizationSQLMessageID = ls.LocalizationSQLMessageID
					WHERE 
						ls.SQLMessageCode = 'MinusBankAccount' AND 
						lsv.Culture = cfg.GetuserCulture()
					
					SET 
						@Message = REPLACE(@Message, '{0}', @DlTitle)

					RAISERROR(@Message, 16, 12)
					RETURN
					--RAISERROR('موجودی حساب بانکی (%s) منفی خواهد شد.',16,12,@DlTitle)
				END
			END
			
			UPDATE 
				FIN.PaymentGuarantyCommitment 
			SET 
				LastState = 3
			WHERE 
				PaymentGuarantyCommitmentID = @PaymentGuarantyCommitmentID
			
			
			SELECT 
				@GuarantyAmount =  p.Amount
			FROM 
				FIN.PaymentGuarantyCommitment p 
			WHERE 
				p.PaymentGuarantyCommitmentID = @PaymentGuarantyCommitmentID
			
			SELECT 
				@SumDeductedAmount = ISNULL((SELECT SUM(g.DeductedAmount)
			FROM 
				FIN.GuarantyOperation g
			WHERE 
				g.CommitmentType = 2 AND
				g.PaymentGuarantyCommitmentID = @PaymentGuarantyCommitmentID AND
				g.OperationType = 2), 0)
			
			SET 
				@FinalDeductedAmount = @GuarantyAmount - @SumDeductedAmount
			
			IF LOWER((SELECT f.ConfigValue FROM CFG.Configuration f
					  WHERE f.ConfigKey = 'BankAccountNegativeStoreControl')) = 'true'
			BEGIN
				SELECT 
					@LastAmount = la.LastAmount,
					@DlTitle = d.Title 
				FROM 
					CFG.BankAccount ba
				JOIN 
					ACC.DL d 
				ON 
					ba.DlID = d.DLID
				JOIN 
					cfg.BankAccount_LastAmount la 
				ON 
					ba.BankAccountID = la.BankAccountID
				WHERE 
					ba.BankAccountID = @BankAccountID
				
				IF (@LastAmount < 0)
				BEGIN
					SELECT 
						@Message = lsv.[Value]
					FROM 
						cfg.LocalizationSQLMessage ls
					JOIN 
						cfg.LocalizationSQLMessageValue lsv 
					ON 
						lsv.LocalizationSQLMessageID = ls.LocalizationSQLMessageID
					WHERE 
						ls.SQLMessageCode = 'MinusBankAccount' AND 
						lsv.Culture = cfg.GetuserCulture()
					
					SET 
						@Message = REPLACE(@Message, '{0}', @DlTitle)

					RAISERROR(@Message, 16, 12)
					RETURN
					--RAISERROR('موجودی حساب بانکی (%s) منفی خواهد شد.',16,12,@DlTitle)
				END
			END
		END
		
		IF (@PreCommitmentType = 2 AND @CommitmentType = 1)
		BEGIN
			UPDATE 
				FIN.PaymentGuarantyCommitment 
			SET 
				LastState = 1
			WHERE 
				PaymentGuarantyCommitmentID = @PrePaymentGuarantyCommitmentID
			
			SELECT 
				@GuarantyAmount =  p.Amount
			FROM 
				FIN.PaymentGuarantyCommitment p 
			WHERE 
				p.PaymentGuarantyCommitmentID = @PrePaymentGuarantyCommitmentID
			
			SELECT 
				@SumDeductedAmount = ISNULL((SELECT SUM(g.DeductedAmount)
			FROM 
				FIN.GuarantyOperation g
			WHERE 
				g.CommitmentType = 2 AND
				g.PaymentGuarantyCommitmentID = @PrePaymentGuarantyCommitmentID AND
				g.OperationType = 2), 0)
			
			SET 
				@FinalDeductedAmount = @GuarantyAmount - @SumDeductedAmount
		
			UPDATE 
				FIN.ReceiveGuarantyCommitment 
			SET 
				LastState = 3
			WHERE 
				ReceiveGuarantyCommitmentID = @ReceiveGuarantyCommitmentID
			
			SELECT 
				@GuarantyAmount = r.Amount
			FROM 
				FIN.ReceiveGuarantyCommitment r 
			WHERE 
				r.ReceiveGuarantyCommitmentID = @ReceiveGuarantyCommitmentID
			
			SELECT 
				@SumDeductedAmount = ISNULL((SELECT SUM(g.DeductedAmount) 
			FROM 
				FIN.GuarantyOperation g 
			WHERE 
				g.CommitmentType = 1 AND 
				g.ReceiveGuarantyCommitmentID = @ReceiveGuarantyCommitmentID AND
				g.OperationType = 2), 0)
			
			SET 
				@FinalDeductedAmount = @GuarantyAmount - @SumDeductedAmount
		END
		
		IF (@PreCommitmentType = 1 AND @CommitmentType = 1)
		BEGIN
			IF (@PreReceiveGuarantyCommitmentID <> @ReceiveGuarantyCommitmentID)
			BEGIN
				UPDATE 
					FIN.ReceiveGuarantyCommitment 
				SET 
					LastState = 1
				WHERE 
					ReceiveGuarantyCommitmentID = @PreReceiveGuarantyCommitmentID
				
				UPDATE 
					FIN.ReceiveGuarantyCommitment 
				SET 
					LastState = 3
				WHERE 
					ReceiveGuarantyCommitmentID = @ReceiveGuarantyCommitmentID
			END
				
			SELECT 
				@GuarantyAmount = r.Amount
			FROM 
				FIN.ReceiveGuarantyCommitment r 
			WHERE 
				r.ReceiveGuarantyCommitmentID = @PreReceiveGuarantyCommitmentID
			
			SELECT 
				@SumDeductedAmount = ISNULL((SELECT SUM(g.DeductedAmount) 
			FROM 
				FIN.GuarantyOperation g 
			WHERE 
				g.CommitmentType = 1 AND 
				g.ReceiveGuarantyCommitmentID = @PreReceiveGuarantyCommitmentID AND
				g.OperationType = 2), 0)
			
			SET 
				@FinalDeductedAmount = @GuarantyAmount - @SumDeductedAmount
			
			IF LOWER((SELECT f.ConfigValue FROM CFG.Configuration f
					  WHERE f.ConfigKey = 'BankAccountNegativeStoreControl')) = 'true'
			BEGIN
				SELECT 
					@LastAmount = la.LastAmount,
					@DlTitle = d.Title 
				FROM 
					CFG.BankAccount ba
				JOIN 
					ACC.DL d 
				ON 
					ba.DlID = d.DLID
				JOIN 
					cfg.BankAccount_LastAmount la 
				ON 
					ba.BankAccountID = la.BankAccountID
				WHERE 
					ba.BankAccountID = @PreBankAccountID
				
				IF (@LastAmount < 0)
				BEGIN
					SELECT 
						@Message = lsv.[Value]
					FROM 
						cfg.LocalizationSQLMessage ls
					JOIN 
						cfg.LocalizationSQLMessageValue lsv 
					ON 
						lsv.LocalizationSQLMessageID = ls.LocalizationSQLMessageID
					WHERE 
						ls.SQLMessageCode = 'MinusBankAccount' AND 
						lsv.Culture = cfg.GetuserCulture()
					
					SET 
						@Message = REPLACE(@Message, '{0}', @DlTitle)

					RAISERROR(@Message, 16, 12)
					RETURN
					--RAISERROR('موجودی حساب بانکی (%s) منفی خواهد شد.',16,12,@DlTitle)
				END
			END
			
			SELECT 
				@GuarantyAmount = r.Amount
			FROM 
				FIN.ReceiveGuarantyCommitment r 
			WHERE 
				r.ReceiveGuarantyCommitmentID = @ReceiveGuarantyCommitmentID
			
			SELECT 
				@SumDeductedAmount = ISNULL((SELECT SUM(g.DeductedAmount) 
			FROM 
				FIN.GuarantyOperation g 
			WHERE 
				g.CommitmentType = 1 AND 
				g.ReceiveGuarantyCommitmentID = @ReceiveGuarantyCommitmentID AND
				g.OperationType = 2),0)
			
			SET 
				@FinalDeductedAmount = @GuarantyAmount - @SumDeductedAmount
		END
		
		IF (@PreCommitmentType = 2 AND @CommitmentType = 2)
		BEGIN
			IF (@PrePaymentGuarantyCommitmentID <> @PaymentGuarantyCommitmentID)
			BEGIN
				UPDATE 
					FIN.PaymentGuarantyCommitment 
				SET 
					LastState = 1
				WHERE 
					PaymentGuarantyCommitmentID = @PrePaymentGuarantyCommitmentID
				
				UPDATE 
					FIN.PaymentGuarantyCommitment 
				SET 
					LastState = 3
				WHERE
					PaymentGuarantyCommitmentID = @PaymentGuarantyCommitmentID
			END
			
			SELECT 
				@GuarantyAmount =  p.Amount
			FROM 
				FIN.PaymentGuarantyCommitment p 
			WHERE 
				p.PaymentGuarantyCommitmentID = @PrePaymentGuarantyCommitmentID
			
			SELECT 
				@SumDeductedAmount = ISNULL((SELECT SUM(g.DeductedAmount)
			FROM 
				FIN.GuarantyOperation g
			WHERE 
				g.CommitmentType = 2 AND
				g.PaymentGuarantyCommitmentID = @PrePaymentGuarantyCommitmentID AND
				g.OperationType = 2), 0)
			
			SET 
				@FinalDeductedAmount = @GuarantyAmount - @SumDeductedAmount
			
			SELECT 
				@GuarantyAmount =  p.Amount
			FROM 
				FIN.PaymentGuarantyCommitment p 
			WHERE 
				p.PaymentGuarantyCommitmentID = @PaymentGuarantyCommitmentID
			
			SELECT 
				@SumDeductedAmount = ISNULL((SELECT SUM(g.DeductedAmount)
			FROM 
				FIN.GuarantyOperation g
			WHERE 
				g.CommitmentType = 2 AND
				g.PaymentGuarantyCommitmentID = @PaymentGuarantyCommitmentID AND
				g.OperationType = 2), 0)
			
			SET 
				@FinalDeductedAmount = @GuarantyAmount - @SumDeductedAmount
			
			IF LOWER((SELECT f.ConfigValue FROM CFG.Configuration f
					  WHERE f.ConfigKey = 'BankAccountNegativeStoreControl')) = 'true'
			BEGIN
				SELECT 
					@LastAmount = la.LastAmount,
					@DlTitle = d.Title 
				FROM 
					CFG.BankAccount ba
				JOIN 
					ACC.DL d 
				ON 
					ba.DlID = d.DLID
				JOIN 
					cfg.BankAccount_LastAmount la 
				ON 
					ba.BankAccountID = la.BankAccountID
				WHERE 
					ba.BankAccountID = @BankAccountID
				
				IF (@LastAmount < 0)
				BEGIN
					SELECT 
						@Message = lsv.[Value]
					FROM 
						cfg.LocalizationSQLMessage ls
					JOIN 
						cfg.LocalizationSQLMessageValue lsv 
					ON 
						lsv.LocalizationSQLMessageID = ls.LocalizationSQLMessageID
					WHERE 
						ls.SQLMessageCode = 'MinusBankAccount' AND 
						lsv.Culture = cfg.GetuserCulture()
					
					SET 
						@Message = REPLACE(@Message, '{0}', @DlTitle)

					RAISERROR(@Message, 16, 12)
					RETURN
					--RAISERROR('موجودی حساب بانکی (%s) منفی خواهد شد.',16,12,@DlTitle)
				END
			END
		END
	END
