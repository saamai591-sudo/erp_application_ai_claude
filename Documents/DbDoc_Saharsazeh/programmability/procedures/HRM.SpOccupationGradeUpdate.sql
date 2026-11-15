CREATE PROC [HRM].[SpOccupationGradeUpdate] 
    @OccupationGradeID int,
    @PaymentSystemID int,
    @Code varchar(50),
    @Title nvarchar(512),
    @Title2 nvarchar(512),
    @Value int,
    @Creator int,
    @CreationDate datetime,
    @LastEditor int,
    @LastEditionDate datetime,
    @Version int
--WITH ENCRYPTION
AS 
	SET NOCOUNT ON 

	if @Version <> (Select [Version] from [HRM].[OccupationGrade]
				where [OccupationGradeID] = @OccupationGradeID)
	begin
		RAISERROR('Version mismatch...', 16 , 10)
		return
	end
		
	IF exists(SELECT * FROM hrm.OccupationGrade  pg
	          WHERE pg.PaymentSystemId=@PaymentSystemID AND Title=@Title AND pg.OccupationGradeID<>@OccupationGradeID  )
	BEGIN
		RAISERROR('عنوان رتبه تکراري مي باشد.',16,12)
		RETURN
	END
	IF exists(SELECT * FROM hrm.OccupationGrade pg
	          WHERE pg.PaymentSystemId=@PaymentSystemID AND Code=@Code AND pg.OccupationGradeID<>@OccupationGradeID )
	BEGIN
		RAISERROR('کد رتبه تکراري مي باشد.',16,12)
		RETURN
	END
	
	declare @oldValue int 

	select @OldValue=value from hrm.[OccupationGrade]
	where  [OccupationGradeID] = @OccupationGradeID

	if @Value<>@OldValue
	begin
		if exists (select 1 from hrm.Agreement
		where [OccupationGradeID] = @OccupationGradeID)
		begin
			RAISERROR('با توجه به اينکه از اين رتبه حقوقي استفاده شده است امکان تغيير مقدار نمي باشد.',16,12)
			RETURN
		end
	end

	set @Version = @Version +1 

	UPDATE [HRM].[OccupationGrade]
	SET    [PaymentSystemID] = @PaymentSystemID, [Code] = @Code, [Title] = @Title, [Title2] = @Title2, [Value] = @Value, [Creator] = @Creator, [CreationDate] = @CreationDate, [LastEditor] = @LastEditor, [LastEditionDate] = @LastEditionDate, [Version] = @Version
	WHERE  [OccupationGradeID] = @OccupationGradeID
	
	-- Begin Return Select <- do not remove
	SELECT  [Version]
	FROM   [HRM].[OccupationGrade]
	WHERE  [OccupationGradeID] = @OccupationGradeID	
	-- End Return Select <- do not remove
