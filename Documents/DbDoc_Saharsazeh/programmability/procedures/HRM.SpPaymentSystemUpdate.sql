CREATE PROC [HRM].[SpPaymentSystemUpdate] 
    @PaymentSystemID int,
    @Code varchar(50),
    @Title nvarchar(512),
    @Title2 nvarchar(512),
    @HasGroup bit,
    @HasBase bit,
    @HasOccupationGrade bit,
    @OccupationGradeType tinyint,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime,
    @Version int
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON 

	if @Version <> (Select [Version] from [HRM].[PaymentSystem]
				where [PaymentSystemID] = @PaymentSystemID)
	begin
		RAISERROR('Version mismatch...', 16 , 10)
		return
	end

	IF EXISTS(
       SELECT 1
       FROM   hrm.PaymentSystem  AS et
       WHERE  et.Code = @Code AND et.PaymentSystemID<>@paymentSystemID
   )
	BEGIN
		RAISERROR('کد تکراري مي باشد.', 16, 12)
		RETURN;
	END

	set @Version = @Version +1 

	UPDATE [HRM].[PaymentSystem]
	SET    [Code] = @Code, [Title] = @Title, [Title2] = @Title2, [HasGroup] = @HasGroup, [HasBase] = @HasBase, [HasOccupationGrade] = @HasOccupationGrade, [OccupationGradeType] = @OccupationGradeType, [Creator] = @Creator, [CreationDate] = @CreationDate, [LastEditor] = @LastEditor, [LastEditionDate] = @LastEditionDate, [Version] = @Version
	WHERE  [PaymentSystemID] = @PaymentSystemID
	
	-- Begin Return Select <- do not remove
	SELECT  [Version]
	FROM   [HRM].[PaymentSystem]
	WHERE  [PaymentSystemID] = @PaymentSystemID	
	-- End Return Select <- do not remove
