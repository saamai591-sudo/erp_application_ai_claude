
-------------------------------------
CREATE   PROC [FIN].[spReceiptCheqeFlowItemUpdate]        
    @ReceiptCheqeFlowItemID int,
    @ReceiptCheqeFlowID int,
    @RowIndex smallint,
    @PreviousFlow int,
    @ReceivedCheqeID int,
    @State tinyint,   
    @Version int,
    @LastEditor int,
    @LastEditionDate datetime
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON 

	DECLARE @prePrevoucherID int,@Date date,@Type tinyint,
	@OldVersion int,@OldReceivedCheqeID int,@OldPreviousFlow int = NULL,@OldState tinyint,
	@OldCurrencyID int,@OldCurrencyRate decimal(10, 4),@OldAmount decimal(30, 4),
	@OldBankAccountID int = NULL,@OldCashID int = NULL,@BankAccountID int = null,@CashID int = null
	
	Select @prePrevoucherID  = f.PreVoucherID,
		   @Date = f.[Date],
		   @Type = f.[Type],
		   @OldVersion = i.[Version],
		   @OldReceivedCheqeID = i.ReceivedCheqeID,
		   @OldPreviousFlow = i.PreviousFlow,
	       @OldState = i.[State],
		   @OldCurrencyID = c.CurrencyID,
		   @OldCurrencyRate = c.CurrencyRate,
		   @OldAmount = c.Amount, 
		   @OldBankAccountID = f.BankAccountID,
		   @OldCashID = f.CashID
	from FIN.ReceiptCheqeFlowItem i
	join FIN.ReceiptCheqeFlow f on i.ReceiptCheqeFlowID = f.ReceiptCheqeFlowID
	join FIN.ReceivedCheqe c on i.ReceivedCheqeID = c.ReceivedCheqeID
	where ReceiptCheqeFlowItemID = @ReceiptCheqeFlowItemID

	
	if (@Version <> @OldVersion or @prePrevoucherID is not null)
	begin
		raiserror('Version mismatch...', 16 , 10)
		return
	end

	if (@OldReceivedCheqeID <> @ReceivedCheqeID and 
	    exists (select * from (select ROW_NUMBER() OVER(PARTITION BY i.ReceivedCheqeID ORDER BY i.ReceiptCheqeFlowItemID desc) rno,
							   i.ReceiptCheqeFlowItemID,i.ReceivedCheqeID,f.[Date]
						       from FIN.ReceiptCheqeFlowItem i
						       join fin.ReceiptCheqeFlow f on i.ReceiptCheqeFlowID = f.ReceiptCheqeFlowID) T
				where T.rno = 1 
				and T.ReceivedCheqeID = @ReceivedCheqeID 
				and T.ReceiptCheqeFlowItemID <> @ReceiptCheqeFlowItemID 
				and T.[Date] > @Date))
	begin
		declare @Number nvarchar(100)
		select @Number = Number from fin.ReceivedCheqe where ReceivedCheqeID = @ReceivedCheqeID
		
		raiserror('چک شماره (%s) به تاریخ بعد از تاریخ مشخص شده گردش دارد.',16,12,@Number)
		return
	end
			
	if (@OldState = 6)
	begin
		select @OldBankAccountID = f.BankAccountID 
		from FIN.ReceiptCheqeFlowItem i
		join FIN.ReceiptCheqeFlow f on i.ReceiptCheqeFlowID = f.ReceiptCheqeFlowID
		where i.ReceiptCheqeFlowItemID = @OldPreviousFlow and i.[State] = 1 and i.ReceivedCheqeID = @OldReceivedCheqeID
	end
		
	if (@State = 6)
	begin
		select @BankAccountID = f.BankAccountID 
		from FIN.ReceiptCheqeFlowItem i
		join FIN.ReceiptCheqeFlow f on i.ReceiptCheqeFlowID = f.ReceiptCheqeFlowID
		where i.ReceiptCheqeFlowItemID = @PreviousFlow and i.[State] = 1 and i.ReceivedCheqeID = @ReceivedCheqeID
	end
		
		
	declare @LastState tinyint
	select @LastState = LastState from FIN.ReceivedCheqe where ReceivedCheqeID = @ReceivedCheqeID
		
	if (@OldReceivedCheqeID <> @ReceivedCheqeID or @OldState <> @State)
	begin
		if (@State = @LastState)
		begin
			raiserror('اطلاعات تغییر یافته است، فرم را بسته و دوباره باز کنید.',16,12) 
			return
		end
	end

	if (@Type = 10)
	begin
		if (@OldReceivedCheqeID <> @ReceivedCheqeID)
		begin

			declare @Latest int = null
			select @Latest = i.PreviousFlow 
			from fin.ReceiptCheqeFlowItem i
			where i.ReceiptCheqeFlowItemID = @PreviousFlow and i.[State] = 1 and i.ReceivedCheqeID = @ReceivedCheqeID

			if (@Latest is null)
				set @State = 0

			if (@Latest is not null)
			begin
				declare @st tinyint
				select @st = i.[State]
				from fin.ReceiptCheqeFlowItem i
				where i.ReceiptCheqeFlowItemID = @Latest and i.ReceivedCheqeID = @ReceivedCheqeID

				set @State = @st
			end

			update FIN.ReceivedCheqe
			set LastState = 1, LastFlow = @OldPreviousFlow
			where ReceivedCheqeID = @OldReceivedCheqeID

		end
	end
	    
	UPDATE [FIN].[ReceiptCheqeFlowItem]
	SET    [RowIndex] = @RowIndex, 
		   [PreviousFlow] = @PreviousFlow, 
	       [ReceivedCheqeID] = @ReceivedCheqeID, 
		   [State] = @State,
		   [Version] = @Version + 1, 
		   [LastEditor] = @LastEditor, 
		   [LastEditionDate] = @LastEditionDate
	WHERE [ReceiptCheqeFlowItemID] = @ReceiptCheqeFlowItemID
	
	DECLARE @CurrencyID int,@CurrencyRate decimal(10, 4),@Amount decimal(30, 4),
    @LastAmount decimal(30, 4) = NULL,@Title nvarchar(256) = NULL,@CurrencyTitle nvarchar(256) = NULL,@Message NVARCHAR(MAX)
	
	select @CurrencyID = CurrencyID, @CurrencyRate = CurrencyRate, @Amount = Amount
	from FIN.ReceivedCheqe where ReceivedCheqeID = @ReceivedCheqeID	
		
	IF (@State = 3)
	BEGIN

		select @CashID = CashID from FIN.ReceiptCheqeFlow where ReceiptCheqeFlowID = @ReceiptCheqeFlowID
			
		IF (@OldCashID <> @CashID or @OldCurrencyID <> @CurrencyID or @OldAmount <> @Amount)
		BEGIN	
			IF LOWER((select f.ConfigValue from CFG.Configuration f
			where f.ConfigKey = 'CashNegativeStoreControl')) = 'true'
			BEGIN
					
				SELECT @LastAmount = la.LastAmount,
					   @Title = c.Title,
					   @CurrencyTitle = cu.Title
				FROM CFG.CashBalance cb
				JOIN CFG.Cash c on cb.CashID = c.CashID
				JOIN CFG.Currency cu on cb.CurrencyID = cu.CurrencyID
				JOIN CFG.Cash_LastAmount la on c.CashID = la.CashID and cb.CurrencyID = la.CurrencyID
				WHERE c.CashID = @OldCashID and cb.CurrencyID = @OldCurrencyID 
					
				IF (@LastAmount < 0)
				BEGIN
					SELECT @Message = lsv.[Value]
					FROM cfg.LocalizationSQLMessage ls
					JOIN cfg.LocalizationSQLMessageValue lsv 
					ON lsv.LocalizationSQLMessageID = ls.LocalizationSQLMessageID
					WHERE ls.SQLMessageCode = 'MinusCash'
					AND lsv.Culture = cfg.GetuserCulture()
					SET @Message = REPLACE(@Message, '{0}', @Title)
					SET @Message = REPLACE(@Message, '{1}', @CurrencyTitle)
							
					RAISERROR(@Message,16,12)
				END
			END
		END
				
	END
		
	IF (@State = 4)
	BEGIN	

		select @BankAccountID = BankAccountID from FIN.ReceiptCheqeFlow where ReceiptCheqeFlowID = @ReceiptCheqeFlowID

		IF (@OldBankAccountID <> @BankAccountID or @OldAmount <> @Amount)
		BEGIN	
			IF LOWER((select f.ConfigValue from CFG.Configuration f
			where f.ConfigKey = 'BankAccountNegativeStoreControl')) = 'true'
			BEGIN
				SELECT @LastAmount = la.LastAmount,
					   @Title = d.Title
				FROM CFG.BankAccount ba
				JOIN ACC.DL d ON ba.DlID = d.DLID
				JOIN CFG.BankAccount_LastAmount la ON ba.BankAccountID = la.BankAccountID
				WHERE ba.BankAccountID = @OldBankAccountID
					
				IF (@LastAmount < 0)
				BEGIN
					SELECT @Message = lsv.[Value]
					FROM cfg.LocalizationSQLMessage ls
					JOIN cfg.LocalizationSQLMessageValue lsv 
					ON lsv.LocalizationSQLMessageID = ls.LocalizationSQLMessageID
					WHERE ls.SQLMessageCode = 'MinusBankAccount'
					AND lsv.Culture = cfg.GetuserCulture()
					SET @Message = REPLACE(@Message, '{0}', @Title)	
				
					RAISERROR(@Message,16,12)
				END
			END	
		END
				
	END

	IF (@OldState = 6)
	BEGIN

		IF ((@State = 6 and (@OldBankAccountID <> @BankAccountID or @OldAmount <> @Amount)) or @State <> 6)
		BEGIN
			IF LOWER((select f.ConfigValue from CFG.Configuration f
			where f.ConfigKey = 'BankAccountNegativeStoreControl')) = 'true'
			BEGIN
				SELECT @LastAmount = la.LastAmount,
					   @Title = d.Title
				FROM CFG.BankAccount ba
				JOIN ACC.DL d ON ba.DlID = d.DLID
				JOIN CFG.BankAccount_LastAmount la ON ba.BankAccountID = la.BankAccountID
				WHERE ba.BankAccountID = @OldBankAccountID
				
				IF (@LastAmount < 0)
				BEGIN
					SELECT @Message = lsv.[Value]
					FROM cfg.LocalizationSQLMessage ls
					JOIN cfg.LocalizationSQLMessageValue lsv 
					ON lsv.LocalizationSQLMessageID = ls.LocalizationSQLMessageID
					WHERE ls.SQLMessageCode = 'MinusBankAccount'
					AND lsv.Culture = cfg.GetuserCulture()
					SET @Message = REPLACE(@Message, '{0}', @Title)	
				
					RAISERROR(@Message,16,12)
				END
			END		
		END
		
	END
		
	IF (@OldReceivedCheqeID <> @ReceivedCheqeID)
	BEGIN
		
		IF (@OldPreviousFlow IS NULL)
		BEGIN
			
			UPDATE [FIN].[ReceivedCheqe]
			SET    [LastState] = 0, [LastFlow] = NULL
			WHERE  [ReceivedCheqeID] = @OldReceivedCheqeID
			
		END
		ELSE
		BEGIN
				
			DECLARE @PreviousState tinyint
			SELECT @PreviousState = r.[State] FROM FIN.ReceiptCheqeFlowItem r
			WHERE r.ReceiptCheqeFlowItemID = @OldPreviousFlow
				
			UPDATE [FIN].[ReceivedCheqe]
			SET    [LastState] = @PreviousState, [LastFlow] = @OldPreviousFlow
			WHERE  [ReceivedCheqeID] = @OldReceivedCheqeID
		END
			
			
		UPDATE [FIN].[ReceivedCheqe]
		SET    [LastState] = @State, [LastFlow] = @ReceiptCheqeFlowItemID
		WHERE  [ReceivedCheqeID] = @ReceivedCheqeID
		
	END
		
	ELSE IF (@OldState <> @State)
	BEGIN
		
		UPDATE [FIN].[ReceivedCheqe]
		SET    [LastState] = @State, [LastFlow] = @ReceiptCheqeFlowItemID
		WHERE  [ReceivedCheqeID] = @ReceivedCheqeID
			
	END

	-- Begin Return Select <- do not remove
	SELECT [Version], [State]
	FROM   [FIN].[ReceiptCheqeFlowItem]
	WHERE  [ReceiptCheqeFlowItemID] = @ReceiptCheqeFlowItemID	
	-- End Return Select <- do not remove
