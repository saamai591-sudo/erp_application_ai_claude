/************************************************************
 * Code formatted by SoftTree SQL Assistant © v9.5.444
 * Time: 6/26/2019 11:01:02 AM
 ************************************************************/

CREATE FUNCTION [CFG].[RemoveDirectionCharacter]
(
	@Input NVARCHAR(MAX)
)
RETURNS NVARCHAR 
(
	MAX
)

BEGIN
	IF @Input IS NULL
		RETURN @Input
	RETURN REPLACE(REPLACE(@Input,NCHAR(8207),''),NCHAR(8206),'')
END