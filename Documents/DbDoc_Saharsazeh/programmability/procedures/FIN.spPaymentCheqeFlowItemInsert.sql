
CREATE   PROC [FIN].spPaymentCheqeFlowItemInsert
    @PaymentCheqeFlowID int,
    @RowIndex smallint,
    @PaymentCheqeID int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime
--WITH ENCRYPTION
AS 
SET NOCOUNT ON 

	declare @Type tinyint,
	        @Date date,
			@BankAccountID int,
			@CheqeBookID int = null,
			@Today bit,
			@LastState tinyint,			
			@MaxDate date = null,
			@Title nvarchar(256) = null
	
	select @Type = [Type],
	       @Date = [Date]
	from FIN.PaymentCheqeFlow 
	where PaymentCheqeFlowID = @PaymentCheqeFlowID
		
	SELECT @BankAccountID = c.BankAccountID,
		   @CheqeBookID = c.CheqeBookID,
		   @Today = t.Today,
		   @LastState = c.LastState
	FROM FIN.PaymentCheqe c
	JOIN FIN.PaymentCheqeType t on c.PaymentCheqeTypeID = t.PaymentCheqeTypeID
	WHERE c.PaymentCheqeID = @PaymentCheqeID

	IF (@Type = 0 or (@Type = 1 and @Today = 1))
	BEGIN

		SELECT @MaxDate = MAX(r.[Date]) FROM FIN.Reconciliation r WHERE r.BankAccountID = @BankAccountID  
		
		IF (@Date <= @MaxDate)
		BEGIN
			SELECT @Title = d.Title FROM CFG.BankAccount b
		    JOIN ACC.DL d on b.DlID = d.DLID
			WHERE b.BankAccountID = @BankAccountID
			
			RAISERROR('به ازای حساب بانکی (%s) به تاریخ بزرگتر یا مساوی تاریخ انتخاب شده مغایرت انجام شده است.لذا هیچ عملیاتی برای این حساب بانکی قابل انجام نیست.',16,12,@Title) 
			return
		END  
	END

    if ((@LastState = 0 and @Type = 0) or (@LastState = 2 and @Type = 1))
    begin
		RAISERROR('اطلاعات تغییر یافته است، فرم را بسته و دوباره باز کنید.',16,12) 
		return
    end
    
	INSERT INTO [FIN].[PaymentCheqeFlowItem] ([PaymentCheqeFlowID], [RowIndex], [PaymentCheqeID],  [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate])
	SELECT @PaymentCheqeFlowID, @RowIndex, @PaymentCheqeID,  0, @Creator, @CreationDate, @LastEditor, @LastEditionDate
	
	-- Begin Return Select <- do not remove
	SELECT [PaymentCheqeFlowItemID], [Version]
	FROM   [FIN].[PaymentCheqeFlowItem]
	WHERE  [PaymentCheqeFlowItemID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
	
	IF (@Type = 0)
	BEGIN
			
		IF LOWER((select f.ConfigValue from CFG.Configuration f
		where f.ConfigKey = 'BankAccountNegativeStoreControl')) = 'true'
		BEGIN
		
			DECLARE @LastAmount decimal(30, 4),
					@DlTitle nvarchar(256),
					@Message NVARCHAR(MAX)
			
			SELECT @LastAmount = la.LastAmount,
			       @DlTitle = d.Title
			FROM CFG.BankAccount ba
			JOIN ACC.DL d ON ba.DlID = d.DLID
			JOIN CFG.BankAccount_LastAmount la on ba.BankAccountID = la.BankAccountID
			WHERE ba.BankAccountID = @BankAccountID
			
			IF (@LastAmount < 0)
			BEGIN
				SELECT @Message = lsv.[Value]
				FROM cfg.LocalizationSQLMessage ls
				JOIN cfg.LocalizationSQLMessageValue lsv 
				ON lsv.LocalizationSQLMessageID = ls.LocalizationSQLMessageID
				WHERE ls.SQLMessageCode = 'MinusBankAccount'
				AND lsv.Culture = cfg.GetuserCulture()
				
				SET @Message = REPLACE(@Message, '{0}', @DlTitle)
				RAISERROR(@Message,16,12)
				--RAISERROR('موجودی حساب بانکی (%s) منفی خواهد شد.',16,12,@DlTitle)
			END
		END
			
		UPDATE [FIN].[PaymentCheqe]
		SET    [LastState] = 0
		WHERE  [PaymentCheqeID] = @PaymentCheqeID	
	END
		
	ELSE IF (@Type = 1)
	BEGIN
	
		UPDATE [FIN].[PaymentCheqe]
		SET    [LastState] = 2
		WHERE  [PaymentCheqeID] = @PaymentCheqeID
		
		IF (@CheqeBookID IS NOT NULL)
		BEGIN
			
			UPDATE [FIN].[CheqeBook]
			SET [Status] = 0
			WHERE [CheqeBookID] = @CheqeBookID 
		END
	END;
