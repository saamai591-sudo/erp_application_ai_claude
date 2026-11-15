CREATE   PROC [FIN].[SpBankBillUpdate] 
    @BankBillID int,
    @BankAccountID int,
    @Number int,
    @Date date,
    @Status tinyint,
    @Amount decimal(30, 4),
    @Version int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime
--WITH ENCRYPTION
AS 

	SET NOCOUNT ON 

	if @Version <> (Select [Version] from [FIN].[BankBill]
				where [BankBillID] = @BankBillID)
	RAISERROR('Version mismatch...', 16 , 10)
	
	DECLARE @HasInitial BIT	

    SELECT @HasInitial = COUNT(BankBillID)
    FROM FIN.BankBill
    WHERE BankAccountID = @BankAccountID  AND [Status] = 1 AND BankBillID <> @BankBillID
           
    IF (@HasInitial > 0 AND @Status = 1)
    BEGIN

		RAISERROR('صورتحساب استقرار قبلا برای این بانک صادر شده است.',16,12)
        RETURN
    END

	if(@Number IS NOT NULL and @Number <> 0)
	begin
		if EXISTS (select * from FIN.BankBill  
		where Number = @Number AND BankBillID <> @BankBillID)
		begin
			raiserror('شماره تکراری است.',16,12)
			return
		end
	end

	if exists (select * from fin.BankBill where BankAccountID = @BankAccountID and [Date] = @Date and BankBillID <> @BankBillID)
	begin
		raiserror('به ازای هر حساب بانکی در یک روز بیش تر از یک صورتحساب نمی توان صادر کرد.',16,12)
		return
	end

	if (@Number is null or @Number = 0)
    set @Number = isnull((select MAX(Number) from FIN.BankBill),0) + 1

	set @Version = @Version +1 

		UPDATE [FIN].[BankBill]
		SET    [BankAccountID] = @BankAccountID, [Number] = @Number, [Date] = @Date, [Status] = @Status, [Amount] = @Amount, [Version] = @Version, [Creator] = @Creator, [CreationDate] = @CreationDate, [LastEditor] = @LastEditor, [LastEditionDate] = @LastEditionDate
		WHERE  [BankBillID] = @BankBillID
	
		-- Begin Return Select <- do not remove
		SELECT [Version], [Number]
		FROM   [FIN].[BankBill]
		WHERE  [BankBillID] = @BankBillID	
		-- End Return Select <- do not remove
