CREATE   PROC [FIN].[SpBankBillInsert]
    @BankAccountID INT ,
    @Number INT ,
    @Date DATE ,
    @Status TINYINT ,
    @Amount DECIMAL(30, 4) ,
    @Creator INT ,
    @CreationDate DATETIME ,
    @LastEditor INT ,
    @LastEditionDate DATETIME 
--WITH ENCRYPTION
AS
    SET NOCOUNT ON 

    DECLARE @HasInitial BIT
	
    SELECT @HasInitial = COUNT(BankBillID)
    FROM FIN.BankBill
    WHERE BankAccountID = @BankAccountID AND [Status] = 1

    IF (@HasInitial > 0 AND @Status = 1)
    BEGIN

		RAISERROR('صورتحساب استقرار قبلا برای این بانک صادر شده است.',16,12)
        RETURN
    END

	if(@Number IS NOT NULL and @Number <> 0)
	begin
		if EXISTS (select * from FIN.BankBill  
		where Number = @Number)
		begin
			raiserror('شماره تکراری است.',16,12)
			return
		end
	end

	if exists (select * from fin.BankBill where BankAccountID = @BankAccountID and [Date] = @Date)
	begin
		raiserror('به ازای هر حساب بانکی در یک روز بیش تر از یک صورتحساب نمی توان صادر کرد.',16,12)
		return
	end

	if (@Number is null or @Number = 0)
    set @Number = isnull((select MAX(Number) from FIN.BankBill),0) + 1
	
    INSERT  INTO [FIN].[BankBill]
            ( [BankAccountID] ,
              [Number] ,
              [Date] ,
              [Status] ,
              [Amount] ,
              [Version] ,
              [Creator] ,
              [CreationDate] ,
              [LastEditor] ,
              [LastEditionDate]
            )
            SELECT  @BankAccountID ,
                    @Number ,
                    @Date ,
                    @Status ,
                    @Amount ,
                    0 ,
                    @Creator ,
                    @CreationDate ,
                    @LastEditor ,
                    @LastEditionDate
	
	-- Begin Return Select <- do not remove
    SELECT  [BankBillID] ,
            [Version]  ,
              [Number] 
    FROM    [FIN].[BankBill]
    WHERE   [BankBillID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
