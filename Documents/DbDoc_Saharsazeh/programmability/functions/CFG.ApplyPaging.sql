

CREATE   FUNCTION [CFG].[ApplyPaging]
(
	@tempTableName     VARCHAR(512),
	@Query             NVARCHAR(MAX),
	@PageIndex         INT,
	@PageSize          INT,
	@Filter            NVARCHAR(MAX),
	@Sort              NVARCHAR(MAX)
)
RETURNS NVARCHAR(MAX)

BEGIN
	DECLARE @selectQuery NVARCHAR(MAX)
	DECLARE @version VARCHAR(128)
	

	SET @version = CAST(serverproperty('ProductVersion') AS nvarchar)
	SET @version = SUBSTRING(@version, 1, CHARINDEX('.', @version) - 1)

	IF @Filter IS NOT NULL
		SET @Filter=REPLACE(@Filter,NCHAR(1610),NCHAR(1740))
	IF @Filter IS NOT NULL
		SET @Filter=REPLACE(@Filter,NCHAR(1603),NCHAR(1705))
		
	 SET @Sort = REPLACE(@Sort, 'CreateDateString', '[CreationDate]');
     SET @Sort = REPLACE(@Sort, 'EditionDateString', '[LastEditionDate]');
     SET @Sort = REPLACE(@Sort, 'Date_', '');
	
	
	IF @version <= '10'
	BEGIN
	    SET @selectQuery = 
	        '
	, TResult as (
			SELECT *
											FROM 
											Query_Result
											' + @Filter + 
	        '
	)
	select * ,row_number() over( ORDER BY (SELECT 0) ) as _RN into ' + @tempTableName +
	        ' from
			(
				select  *
				,row_number() over (order by ' + @Sort + 
	        ') as RowOrder,
				tCount.Row_Count as r_count 	 from 
				TResult  
				Cross Join(select count(*) as Row_Count from TResult) as tCount
			)Result '
	        +
	        CASE 
	             WHEN @pageSize = 0 THEN ''
	             ELSE '	WHERE RowOrder BETWEEN (' + CAST(((@pageIndex - 1) * @pageSize + 1) AS VARCHAR(20))
	                  + ') AND (' + CAST((@pageIndex * @pageSize) AS VARCHAR(20))
	                  + ')'
	        END + '
		 order by Result.RowOrder '
	END
	ELSE
	BEGIN
	     SET @selectQuery = 
	        '
	, TResult as (
			SELECT *
											FROM 
											Query_Result
											' + @Filter + 
	        '
	)
	select *,row_number() over( ORDER BY '+CASE  @PageSize WHEN 0 THEN @Sort ELSE '(SELECT 0)' END +'  ) as _RN  into ' + @tempTableName +
	        ' from
						(
							select  *,
							tCount.Row_Count as r_count 	 from 
								TResult  
								Cross Join(select count(*) as Row_Count from TResult) as tCount
						)Result Order BY '+ @Sort
	        +
	        CASE 
	             WHEN @pageSize = 0 THEN ''
	             ELSE ' OFFSET '+CAST( ((@pageIndex - 1) * @pageSize) AS VARCHAR(100))+' ROWS
						FETCH NEXT '+CAST(@PageSize AS VARCHAR(100))+' ROWS ONLY;'
	        END 
	END
	
	RETURN @Query+   @selectQuery
END
