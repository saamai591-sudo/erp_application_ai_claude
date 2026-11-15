CREATE     PROC [FIN].[spPaymentCheqeTypeUpdate]
    @PaymentCheqeTypeID int,
    @Title nvarchar(256),
    @Title2 nvarchar(256),
    @Today bit,
	@SlID int,
    @Version int,
    @LastEditor int,
    @LastEditionDate datetime
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON 


	if @Version <> (Select [Version] from [FIN].PaymentCheqeType
	where PaymentCheqeTypeID = @PaymentCheqeTypeID)
	begin
	RAISERROR('Version mismatch...', 16 , 10)
	return
	end

	if @Today = 1 set @SlID = null

	if exists (select * from fin.PaymentCheqe where PaymentCheqeTypeID = @PaymentCheqeTypeID )
		UPDATE [FIN].PaymentCheqeType
		SET     [Title] = @Title, 
				[Title2] = @Title2, 
				[Version] = @Version + 1, 
				[LastEditor] = @LastEditor, 
				[LastEditionDate] = @LastEditionDate
		WHERE  PaymentCheqeTypeID = @PaymentCheqeTypeID
	else
		UPDATE [FIN].PaymentCheqeType
		SET     [Title] = @Title, 
				[Title2] = @Title2, 
				[Today] = @Today, 
				[SlID] = @SlID,
				[Version] = @Version + 1, 
				[LastEditor] = @LastEditor, 
				[LastEditionDate] = @LastEditionDate
		WHERE  PaymentCheqeTypeID = @PaymentCheqeTypeID
	
		-- Begin Return Select <- do not remove
	SELECT [Version]
	FROM   [FIN].PaymentCheqeType
	WHERE  [PaymentCheqeTypeID] = @PaymentCheqeTypeID	
		-- End Return Select <- do not remove
