CREATE     PROC [FIN].[spPaymentCheqeTypeInsert]
    @Title nvarchar(256),
    @Title2 nvarchar(256),
    @Today bit,
	@SlID int,
    @Creator int,
    @CreationDate datetime
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON 
	SET XACT_ABORT ON  
	
	if @Today = 1 set @SlID = null

	INSERT INTO [FIN].PaymentCheqeType ([Title], [Title2],  Today,SlID, [Version], [Creator], [CreationDate], [LastEditor], [LastEditionDate])
	SELECT  @Title, @Title2,  @Today,@SlID, 0, @Creator, @CreationDate, @Creator, @CreationDate
	
	-- Begin Return Select <- do not remove
	SELECT [PaymentCheqeTypeID],  [Version]
	FROM   [FIN].PaymentCheqeType
	WHERE  [PaymentCheqeTypeID] = SCOPE_IDENTITY()
	-- End Return Select <- do not remove
