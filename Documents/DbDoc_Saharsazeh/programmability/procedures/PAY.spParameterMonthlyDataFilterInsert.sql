
--------------------------------------------------------------------------------------------
CREATE   PROC PAY.spParameterMonthlyDataFilterInsert
    @Title NVARCHAR(256),
    @Title2 NVARCHAR(256),
    @PersonelCode BIT,
    @PersonelName BIT,
    @WorkPlace BIT,
    @CostCenter BIT,
    @EmploymentType BIT,
    @IsForSystemParameterTypes BIT,
    @Branch BIT,
	@SystemType tinyint,
    @Creator INT,
    @CreationDate DATETIME,
    @LastEditor INT,
    @LastEditionDate DATETIME,
	@NationalCode BIT
			--WITH ENCRYPTION 
AS 
BEGIN
	SET NOCOUNT ON
	
	IF EXISTS (
	       SELECT *
	       FROM   PAY.ParameterMonthlyDataFilter p
	       WHERE  p.Title = @Title
	   )
	BEGIN
	    RAISERROR('عنوان نمی تواند تکراری باشد.', 16, 12)
	END 	
	
	
	INSERT INTO [PAY].[ParameterMonthlyDataFilter]
	  (
	    [Title],
	    [Title2],
	    [PersonelCode],
	    [PersonelName],
	    [WorkPlace],
	    [CostCenter],
	    [EmploymentType],
	    [Version],
	    [Creator],
	    [CreationDate],
	    [LastEditor],
	    [LastEditionDate],
	    IsForSystemParameterTypes,
	    [Branch],
		SystemType,
		[NationalCode]
	  )
	SELECT @Title,
	       @Title2,
	       @PersonelCode,
	       @PersonelName,
	       @WorkPlace,
	       @CostCenter,
	       @EmploymentType,
	       0,
	       @Creator,
	       @CreationDate,
	       @LastEditor,
	       @LastEditionDate,
	       @IsForSystemParameterTypes,
	       @Branch,
		   @SystemType,
		   @NationalCode
	
	-- Begin Return Select <- do not remove
	SELECT [ParameterMonthlyDataFilterID],
	       [Version]
	FROM   [PAY].[ParameterMonthlyDataFilter]
	WHERE  [ParameterMonthlyDataFilterID] = SCOPE_IDENTITY()
	       -- End Return Select <- do not remove
END;

