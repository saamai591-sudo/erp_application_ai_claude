Create PROCEDURE [PAY].[UpdateParameterMonthlyDataFilterInfo](
    @ParameterMonthlyDataFilterID     INT,
    @selectedEmploymentType           VARCHAR(MAX),
    @selectedParameter                VARCHAR(MAX)
)
AS
	DELETE pay.ParameterMonthlyDataFilterEmploymentType
	WHERE  ParameterMonthlyDataFilterID = @ParameterMonthlyDataFilterID
	
	
	DELETE pay.ParameterMonthlyDataFilterParameter
	WHERE  ParameterMonthlyDataFilterID = @ParameterMonthlyDataFilterID
	
	DECLARE @UserId INT
	SET @UserId = cfg.GetuserID()
	
	INSERT INTO pay.ParameterMonthlyDataFilterEmploymentType
	  (
	    -- ParameterMonthlyDataFilterEmploymentTypeID -- this column value is auto-generated
	    ParameterMonthlyDataFilterID,
	    EmploymentTypeID,
	    Version,
	    Creator,
	    CreationDate,
	    LastEditor,
	    LastEditionDate
	  )
	SELECT @PArameterMonthlyDataFilterID,
	       rfcst.[value],
	       1,
	       @UserId,
	       GETDATE(),
	       @UserId,
	       GETDATE()
	FROM   cfg.R_FnCommaStr2Table(@selectedEmploymentType) AS rfcst
	
	
	INSERT INTO pay.ParameterMonthlyDataFilterParameter
	  (
	    -- ParameterMonthlyDataFilterParameterID -- this column value is auto-generated
	    ParameterMonthlyDataFilterID,
	    ParameterID,
	    Version,
	    Creator,
	    CreationDate,
	    LastEditor,
	    LastEditionDate
	  )
	SELECT @PArameterMonthlyDataFilterID,
	       rfcst.[value],
	       1,
	       @UserId,
	       GETDATE(),
	       @UserId,
	       GETDATE()
	FROM   cfg.R_FnCommaStr2Table(@selectedParameter) AS rfcst
	
